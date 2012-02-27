// Javascript Library for Multi-step Asynchronous Logic
// Version 0.2.2
// Copyright (c) 2010 William R. Conant, WillConant.com
// Licensed under the MIT license: http://www.opensource.org/licenses/mit-license.php

define(function() {
	// converts native arguments object to an array and applies function
	function applyArgs(func, thisObj, args) {
		return func.apply(thisObj, Array.prototype.slice.call(args));
	}
	
	// defines a flow given any number of functions as arguments
	function define() {	
		var thisFlow = function() {
			applyArgs(thisFlow.exec, thisFlow, arguments);
		}
		
		thisFlow.blocks = arguments;
		
		thisFlow.exec = function() {
			// The flowState is the actual object each step in the flow is applied to. It acts as a
			// callback to the next function. It also maintains the internal state of each execution
			// and acts as a place for users to save values between steps of the flow.
			var flowState = function() {
				if (flowState.__frozen) return;
				
				if (flowState.__timeoutId) {
					clearTimeout(flowState.__timeoutId);
					delete flowState.__timeoutId;
				}
				
				var blockIdx = flowState.__nextBlockIdx ++;
				var block = thisFlow.blocks[blockIdx];
				
				if (block === undefined) {
					return;
				}
				else {
					applyArgs(block, flowState, arguments);
				}
			}
			
			// __nextBlockIdx specifies which function is the next step in the flow.
			flowState.__nextBlockIdx = 0;
			
			// __multiCount is incremented every time MULTI is used to createa a multiplexed callback
			flowState.__multiCount = 0;
			
			// __multiOutputs accumulates the arguments of each call to callbacks generated by MULTI
			flowState.__multiOutputs = [];
			
			// REWIND signals that the next call to thisFlow should repeat this step. It allows you
			// to create serial loops.
			flowState.REWIND = function() {
				flowState.__nextBlockIdx -= 1;
			}
			
			// MULTI can be used to generate callbacks that must ALL be called before the next step
			// in the flow is executed. Arguments to those callbacks are accumulated, and an array of
			// of those arguments objects is sent as the one argument to the next step in the flow.
			// @param {String} resultId An identifier to get the result of a multi call.
			flowState.MULTI = function(resultId) {
				flowState.__multiCount += 1;
				return function() {
					flowState.__multiCount -= 1;
					flowState.__multiOutputs.push(arguments);

          if (resultId) {
            var result = arguments.length <= 1 ? arguments[0] : arguments
            flowState.__multiOutputs[resultId] = result;
          }
					
					if (flowState.__multiCount === 0) {
						var multiOutputs = flowState.__multiOutputs;
						flowState.__multiOutputs = [];
						flowState(multiOutputs);
					}
				}
			}
						
			// TIMEOUT sets a timeout that freezes a flow and calls the provided callback. This
			// timeout is cleared if the next flow step happens first.
			flowState.TIMEOUT = function(milliseconds, timeoutCallback) {
				if (flowState.__timeoutId !== undefined) {
					throw new Error("timeout already set for this flow step");
				}
				
				flowState.__timeoutId = setTimeout(function() {
					flowState.__frozen = true;
					timeoutCallback();
				}, milliseconds);
			}
			
			applyArgs(flowState, this, arguments);
		}
		
		return thisFlow;
	}
	
	// defines a flow and evaluates it immediately. The first flow function won't receive any arguments.
	function exec() {
		applyArgs(define, this, arguments)();
	}
	
	// a very useful flow for serial execution of asynchronous functions over a list of values
	// (idea suggested by John Wright, http://github.com/mrjjwright)
	var serialForEach = define(
		function(items, job, between, finish) {
			this.items = items;
			this.curItem = 0;
			this.job = job;
			this.between = between;
			this.finish = finish;
			this();
	 
		},function() {
			if (this.curItem > 0 && this.between) {
				applyArgs(this.between, this, arguments);
			}
			
			if (this.curItem >= this.items.length) {
				this();
			}
			else {
				this.REWIND();
				this.curItem += 1;
				this.job(this.items[this.curItem - 1]);
			}
	 
		},function() {
			if (this.finish) this.finish();
		}
	);

	return {
        "define": define,
	    "exec": exec,
	    "serialForEach": serialForEach
	};
});
