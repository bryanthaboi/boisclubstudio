(function () {
	let earningsQuery = null;
	let cumSubsQueryTemplate = null;

	// Load queries from external JSON file
	async function loadQueries() {
		try {
			// Try to get URL from script tag attribute first, fallback to chrome.runtime.getURL
			let queriesUrl;
			const scriptTag = document.getElementById('bcs-join-hook');
			if (scriptTag && scriptTag.getAttribute('data-queries-url')) {
				queriesUrl = scriptTag.getAttribute('data-queries-url');
			} else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
				queriesUrl = chrome.runtime.getURL('data/queries.json');
			} else {
				throw new Error('Cannot determine queries.json URL');
			}
			const response = await fetch(queriesUrl);
			const queries = await response.json();

			earningsQuery = JSON.parse(JSON.stringify(queries.earningsQuery));
			cumSubsQueryTemplate = JSON.parse(JSON.stringify(queries.cumSubsQueryTemplate));
		} catch (e) {
			console.error("[BCS] Failed to load queries.json:", e);
			// Fallback to inline queries if file fails to load
			earningsQuery = {
				"key": "2__TOP_ENTITIES_TABLE_QUERY_KEY",
				"value": {
					"query": {
						"dimensions": [{ "type": "VIDEO" }],
						"metrics": [
							{ "type": "SUBSCRIBERS_NET_CHANGE", "includeTotal": true },
							{ "type": "TOTAL_ESTIMATED_EARNINGS", "includeTotal": true },
							{ "type": "EXTERNAL_WATCH_TIME", "includeTotal": true },
							{ "type": "VIDEO_THUMBNAIL_IMPRESSIONS_VTR", "includeTotal": true }
						],
						"restricts": [{
							"dimension": { "type": "ARTIST_BASS_COMPACT_KEY" },
							"inValues": ["a_DJw5yqSfXQR"]
						}],
						"orders": [{
							"metric": { "type": "TOTAL_ESTIMATED_EARNINGS" },
							"direction": "ANALYTICS_ORDER_DIRECTION_DESC"
						}],
						"timeRange": {
							"dateIdRange": {
								"inclusiveStart": 20251009,
								"exclusiveEnd": 20251106
							}
						},
						"limit": { "pageSize": 50, "pageOffset": 0 },
						"currency": "USD",
						"returnDataInNewFormat": true,
						"limitedToBatchedData": false
					}
				}
			};
		}
	}

	function getCumSubsQuery() {
		if (!cumSubsQueryTemplate) return null;
		let enabledExperiments = JSON.stringify(Object.keys(window.ytcfg.get("EXPERIMENT_FLAGS")));
		let experimentFlags = makeExperimentFlags(window.ytcfg.get("EXPERIMENT_FLAGS"));

		let queryStr = JSON.stringify(cumSubsQueryTemplate);
		queryStr = queryStr.replace('"__ENABLED_EXPERIMENTS_PLACEHOLDER__"', enabledExperiments);
		queryStr = queryStr.replace('"__EXPERIMENT_FLAGS_PLACEHOLDER__"', experimentFlags);

		return JSON.parse(queryStr);
	}

	function makeExperimentFlags(input) {
		let experimentFlags = [];
		Object.keys(input).forEach(key => {
			let item = input[key];
			experimentFlags.push({
				"key": key,
				"value": {
					"boolValue": typeof item.value === "boolean" ? item.value : Boolean(item.value)
				}
			});
		});
		return JSON.stringify(experimentFlags);
	}

	try {
		if (window.ytcfg) {
			if (window.ytcfg.get("DELEGATION_CONTEXT")) {
				let delegationContext = window.ytcfg.get("DELEGATION_CONTEXT");
				if (delegationContext) {
					let artistID = delegationContext.artistId;
					let channelID = delegationContext.oacChannelId;
					let externalChannelID = delegationContext.externalChannelId;

					window.postMessage(
						{ source: "bcs", type: "IDS", payload: { artistID, channelID, externalChannelID } },
						"*"
					);
				}
			}
		}
	} catch (e) {
		console.log("error getting ytcfg", e);
	}

	// Initialize queries and install hooks
	loadQueries().then(() => {
		installHooks();
	}).catch(err => {
		console.error("[BCS] Failed to initialize:", err);
		// Try to install hooks anyway with fallback queries
		installHooks();
	});

	function installHooks() {
		if (window.__bcsJoinHookInstalled) return;
		window.__bcsJoinHookInstalled = true;
		const JOIN_ENDPOINT_REGEX = /\/youtubei\/v1\/yta_web\/join/i;

		// Initialize subscriber node cache if not exists
		if (!window.__bcsCachedSubscriberNode) {
			window.__bcsCachedSubscriberNode = null;
		}

		// Function to get cached subscriber node (with retry if not loaded yet)
		function getSubscriberNode() {
			let delegationContext = window.ytcfg.get("DELEGATION_CONTEXT");
			if (delegationContext) {
				let artistID = delegationContext.artistId;
				let channelID = delegationContext.oacChannelId;
				let externalChannelID = delegationContext.externalChannelId;
			}
			let entity = delegationContext?.artistId ? `{
				"artistId": "${delegationContext.artistId}",
				"artistDetails": {
				"artistId": "${delegationContext.artistId}",
				"oacChannelId": "${delegationContext.oacChannelId}",
				"isVideoOwnedByArtist": false
		}}` : `{
				"channelId": "${delegationContext?.externalChannelId}"
			}`

			let cumSubsQuery = getCumSubsQuery();
			if (!cumSubsQuery) return null;

			cumSubsQuery.value.getCards.screenConfig.entity = JSON.parse(entity);

			return cumSubsQuery;
		}

		const originalFetch = window.fetch;
		if (typeof originalFetch === "function") {
			window.fetch = function () {
				let request = arguments[0];
				const url =
					(typeof request === "string" && request) ||
					(request && request.url) ||
					"";

				// Intercept and modify request body for join calls
				// Note: Request objects are harder to modify synchronously, so we focus on XHR which is more commonly used
				const cachedNode = getSubscriberNode();
				if (url && JOIN_ENDPOINT_REGEX.test(url)) {
					try {
						// Only handle plain objects with body property (not Request objects)
						if (request && typeof request === "object" && !(request instanceof Request) && request.body) {
							try {
								let bodyData = null;
								if (typeof request.body === "string") {
									bodyData = JSON.parse(request.body);
								} else {
									bodyData = request.body;
								}

								if (bodyData && Array.isArray(bodyData.nodes)) {
									const hasSubscriberNode = bodyData.nodes.some(node =>
										node && node.key === "0__CUMULATIVE_SUBSCRIBERS_KEY"
									);
									if (bodyData.nodes.length == 1 && bodyData.nodes[0].key === "0__CUMULATIVE_SUBSCRIBERS_KEY") {

										try {
											//localStorage.setItem("bcsCachedSubscriberNode", JSON.stringify(bodyData.nodes[0]));
										} catch (e) {
											console.log("Error caching subscriber node:", e);
										}
									}
									if (!hasSubscriberNode && cachedNode) {
										bodyData.nodes.push(cachedNode);
										if (typeof request.body === "string") {
											request.body = JSON.stringify(bodyData);
										} else {
											request.body = bodyData;
										}
									}
								}
							} catch (e) {
								console.log("error modifying request", e);
								// Can't modify, skip
							}
						}
					} catch (error) {
						// Error intercepting, continue with original request
						console.log("error joining", error);
					}
				}

				const result = originalFetch.apply(this, arguments);
				try {

					if (url && JOIN_ENDPOINT_REGEX.test(url) && result?.clone) {

						result
							.clone()
							.json()
							.then((payload) => {


								window.postMessage(
									{ source: "bcs", type: "JOIN_PAYLOAD", payload },
									"*"
								);
							})
							.catch(() => { });
					}
				} catch (error) {
					console.log(error);
					console.log(error.message);
				}
				return result;
			};
		}

		const proto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
		if (proto) {
			const originalOpen = proto.open;
			const originalSend = proto.send;

			proto.open = function (method, url) {
				this.__bcsJoinUrl = url;
				return originalOpen.apply(this, arguments);
			};

			proto.send = function () {
				if (this.__bcsJoinUrl && JOIN_ENDPOINT_REGEX.test(String(this.__bcsJoinUrl))) {
					// Intercept and modify request body before sending
					try {

						const data = arguments[0];
						const subscriberNode = getSubscriberNode();
						if (data && subscriberNode) {
							let bodyData = null;
							let continueWithRequest = false;
							if (typeof data === "string") {
								try {
									bodyData = JSON.parse(data);
								} catch (e) {
									// Not JSON, skip
								}
							} else if (data instanceof FormData || data instanceof Blob) {
								// Can't easily modify these, skip
							} else {
								bodyData = data;
							}

							if (bodyData && Array.isArray(bodyData.nodes)) {
								if (bodyData.nodes.length > 1 && bodyData.nodes[0].key === "0__RECENT_VIDEOS") {
									if (bodyData.nodes[1].key === "0__TOP_VIDEOS") {
										if (bodyData.nodes?.[2]?.key === "0__TOP_VIDEO_META") {
											continueWithRequest = true;
										}
									}
								}
							}
							// Check if this looks like a LATEST_ACTIVITY call (has nodes array)
							if (continueWithRequest) {

								// Check if subscriber node is not already present
								const hasSubscriberNode = bodyData.nodes.some(node =>
									node && node.key === "0__CUMULATIVE_SUBSCRIBERS_KEY"
								);


								if (!hasSubscriberNode) {
									// Add the cached subscriber node
									bodyData.nodes.push(subscriberNode);
									// Update the data to send
									if (typeof data === "string") {
										arguments[0] = JSON.stringify(bodyData);
									} else {
										arguments[0] = bodyData;
									}
								}
								let topVideosNode = null;
								topVideosNode = bodyData.nodes.find(node =>
									node && node.key === "0__TOP_VIDEOS"
								);
								const topVideosNodeIndex = bodyData.nodes.indexOf(topVideosNode);

								let restricts = bodyData.nodes[topVideosNodeIndex].value.query.restricts;
								if (earningsQuery) {
									// Clone earningsQuery to avoid mutating the original
									let earningsQueryClone = JSON.parse(JSON.stringify(earningsQuery));
									earningsQueryClone.value.query.restricts = restricts;

									earningsQueryClone.value.query.timeRange.dateIdRange.inclusiveStart = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, ''); // today minus 30 days
									earningsQueryClone.value.query.timeRange.dateIdRange.exclusiveEnd = new Date().toISOString().split('T')[0].replace(/-/g, ''); // needs to be in format 20251009 aka YEARMONTHDAY
									bodyData.nodes.push(earningsQueryClone);
								}
								if (typeof data === "string") {
									arguments[0] = JSON.stringify(bodyData);
								} else {
									arguments[0] = bodyData;
								}
								hourlyNode = bodyData.nodes.find(node =>
									node && node.key === "0__HOURLY_PER_VIDEO"
								);


							}
						}
					} catch (e) {
						console.log("Error modifying XHR request:", e);
					}

					this.addEventListener(
						"load",
						function handler() {
							try {
								if (
									this.responseType &&
									this.responseType !== "" &&
									this.responseType !== "text"
								) {

									if (this.response && typeof this.response === "object") {
										window.postMessage(
											{ source: "bcs", type: "JOIN_PAYLOAD", payload: this.response },
											"*"
										);
									}
									return;
								}
								const text = this.responseText;
								if (!text) return;
								let payload = null;
								try {
									payload = JSON.parse(text);
								} catch (_) {
									return;
								}


								window.postMessage(
									{ source: "bcs", type: "JOIN_PAYLOAD", payload },
									"*"
								);
							} catch (_) { }
						},
						{ once: true }
					);
				}
				return originalSend.apply(this, arguments);
			};
		}

	}
})();
