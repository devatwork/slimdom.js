/**
 * @submodule mutations
 */
if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(
	function() {
		'use strict';

		/**
		 * A helper class which is responsible for scheduling the queued MutationRecord objects for reporting by their
		 * observer. Reporting means the callback of the observer (a MutationObserver object) gets called with the
		 * relevant MutationRecord objects.
		 *
		 * @class NotifyList
		 * @constructor
		 */
		function NotifyList() {
			// None of these properties are designed to be exposed.

			this.notifyList = [];

			this.scheduled = null;

			this.callbacks = [];
		}

		/**
		 * Adds a given MutationRecord to the recordQueue of the given MutationObserver and schedules it for reporting.
		 *
		 * @method queueRecord
		 *
		 * @param  {MutationObserver}  observer  The MutationObserver to whose recordQueue the given record is added.
		 * @param  {MutationRecord}    record    The MutationRecord that will be added and reported.
		 */
		NotifyList.prototype.queueRecord = function(observer, record) {
			// Only queue the same record once per observer
			if (observer.recordQueue[observer.recordQueue.length - 1] === record)
				return;

			observer.recordQueue.push(record);
			this.notifyList.push(observer);
			this.scheduleInvoke();
		};

		/**
		 * Takes all the records from all the observers currently on this list and clears the current list.
		 *
		 * @method clear
		 */
		NotifyList.prototype.clear = function() {
			for (var i = 0, l = this.notifyList.length; i < l; ++i) {
				// Empty all record queues
				var observer = this.notifyList[i];
				observer.takeRecords();
			}

			// Clear the notify list
			this.notifyList.length = 0;
		};

		var hasSetImmediate = (typeof setImmediate === 'function');
		function schedule(callback, thisArg) {
			var args = Array.prototype.slice.call(arguments, 2);
			return (hasSetImmediate ? setImmediate : setTimeout)(function() {
				callback.apply(thisArg, args);
			}, 0);
		}

		/**
		 * An internal helper method which is used to start the scheduled invocation of the callback from each of the
		 * observers on the current list, i.e. to report the MutationRecords.
		 *
		 * @method scheduleInvoke
		 * @private
		 */
		NotifyList.prototype.scheduleInvoke = function() {
			if (this.scheduled)
				return;

			this.scheduled = schedule(function() {
				this.scheduled = null;
				this.invokeMutationObservers();
			}, this);
		};

		function removeTransientRegisteredObserversForObserver(observer) {
			// Remove all transient registered observers for this observer
			// Process in reverse order, as the targets array may change during traversal
			for (var i = observer.targets.length - 1; i >= 0; --i) {
				observer.targets[i].registeredObservers.removeTransients(observer);
			}
		}

		/**
		 * An internal helper method which is used to invoke the callback from each of the observers on the current
		 * list, i.e. to report the MutationRecords.
		 *
		 * @method invokeMutationObservers
		 * @private
		 */
		NotifyList.prototype.invokeMutationObservers = function() {
			// Process notify list
			var numCallbacks = 0;
			for (var i = 0, l = this.notifyList.length; i < l; ++i) {
				var observer = this.notifyList[i],
					queue = observer.takeRecords();

				if (!queue.length) {
					removeTransientRegisteredObserversForObserver(observer);
					continue;
				}

				// Observer has records, schedule its callback
				++numCallbacks;
				schedule(function(queue, observer) {
					try {
						// According to the spec, transient registered observers for observer
						// should be removed just before its callback is called.
						removeTransientRegisteredObserversForObserver(observer);
						observer.callback.call(null, queue, observer);
					} finally {
						--numCallbacks;
						if (!numCallbacks) {
							// Callbacks may have queued additional mutations, check again later
							this.scheduleInvoke();
						}
					}
				}, this, queue, observer);
			}

			this.notifyList.length = 0;
		};

		return NotifyList;
	}
);
