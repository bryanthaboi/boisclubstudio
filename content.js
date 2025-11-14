(function () {
	// Hella variables
	const PANEL_ID = "bcs-quick-panel";
	const STYLE_ID = "bcs-styles";
	const ANALYTICS_STYLE_ID = "bcs-analytics-style";
	let bcsArtistID = null;
	let bcsChannelID = null;
	let bcsAnalyticsSyncScheduled = false;
	let bcsJoinInterceptorInstalled = false;
	const bcsJoinVideoTitleMap = new Map(); // Deprecated - kept for backward compatibility
	const bcsJoinVideoIdMap = new Map(); // New: indexed by video ID
	const bcsToastQueue = []; // Queue of pending toasts
	let bcsToastContainer = null; // Toast container element
	let bcsPanelCheckTimeout = null;
	let bcsAnalyticsObserver = null;
	let bcsCustomTableContainer = null; // Custom table container
	let bcsWarmingUpSpinner = null; // Warming up spinner element
	let bcsSettingsPanel = null; // Settings panel element
	let bcsSettingsPanelOpen = false; // Settings panel open state
	// Electron backend integration
	let bcsElectronBackendEnabled = false;
	let bcsElectronBackendUrl = "http://localhost:6767";
	let bcsElectronConnectionId = null;
	let bcsElectronHeartbeatInterval = null;
	let bcsElectronConnectionStatusElement = null;
	const bcsViewHistory = new Map(); // videoId -> {hourly: {timestamps: [], counts: []}, minutely: {timestamps: [], counts: []}}
	let bcsCustomTableData = []; // Current sorted video data for custom table
	let bcsLastUpdateHash = ""; // Hash to detect if data actually changed
	const bcsPreviousMetrics = new Map(); // videoId -> {likeCount, commentCount, dislikeCount} for change detection
	let bcsSubscriberCount = null; // Current subscriber count from cached node
	let bcsSubscriberHistory = []; // Array of {dateId, count} for sparkline chart
	let bcsPreviousSubscriberCount = null; // For change detection
	const bcsVideoEarnings = new Map(); // videoId -> earnings in dollars
	const bcsVideoSubscriberNetChange = new Map(); // videoId -> subscriber net change
	const bcsVideoWatchTime = new Map(); // videoId -> external watch time (milliseconds)
	const bcsVideoCTR = new Map(); // videoId -> CTR (VIDEO_THUMBNAIL_IMPRESSIONS_VTR)
	let bcsTotalWatchTime = 0; // Total external watch time in milliseconds for 30-day banner
	const bcsMetricChangeHistory = new Map(); // videoId -> { metricType: [{timestamp, value}, ...] }
	const bcsSubscriberChangeHistory = []; // Array of {timestamp, value} for subscriber count

	// Settings system
	const DEFAULT_SETTINGS = {
		// Badge visibility
		badges: {
			likes: true,
			comments: true,
			dislikes: true
		},
		// Top panel visibility
		panels: {
			subscribers: true,
			watchtime: true,
			likes: true,
			comments: true,
			revenue: true
		},
		// Hidden elements (cards/tabs that are currently hidden by CSS)
		hiddenElements: {
			channelDashboardIdeasCard: true,
			channelDashboardCreatorInsiderCard: true,
			channelDashboardProductUpdatesCard: true,
			channelDashboardCreatorRecognitionCard: true,
			channelDashboardShoppingCard: true,
			channelDashboardNewsCard: true,
			channelDashboardRecentVideosCard: true,
			podcastListTab: true,
			artistReleasesTab: true,
			videoListCollabsTab: true,
			seeExploreSubscribersButton: true,
			realtimeChart: true,
			latestActivityCardMainChart: true
		},
		// Electron backend
		electronBackend: {
			enabled: false,
			url: "http://localhost:6767"
		},
		// Hot streak configuration
		hotStreak: {
			increases: 5,
			timeWindowMinutes: 5
		}
	};

	let bcsSettings = { ...DEFAULT_SETTINGS };

	// Load settings from chrome.storage
	async function loadSettings() {
		return new Promise((resolve) => {
			if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
				chrome.storage.local.get(["bcsSettings"], (result) => {
					if (result.bcsSettings) {
						// Merge with defaults to handle new settings
						bcsSettings = {
							...DEFAULT_SETTINGS,
							...result.bcsSettings,
							badges: { ...DEFAULT_SETTINGS.badges, ...(result.bcsSettings.badges || {}) },
							panels: { ...DEFAULT_SETTINGS.panels, ...(result.bcsSettings.panels || {}) },
							hiddenElements: { ...DEFAULT_SETTINGS.hiddenElements, ...(result.bcsSettings.hiddenElements || {}) },
							electronBackend: { ...DEFAULT_SETTINGS.electronBackend, ...(result.bcsSettings.electronBackend || {}) },
							hotStreak: { ...DEFAULT_SETTINGS.hotStreak, ...(result.bcsSettings.hotStreak || {}) }
						};
					}
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	// Save settings to chrome.storage
	function saveSettings() {
		if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
			chrome.storage.local.set({ bcsSettings: bcsSettings }, () => {
				console.log("[BCS] Settings saved");
			});
		}
	}

	const LINKS = [
		{
			key: "shortsPublic",
			title: "Public shorts",
			href: `https://studio.youtube.com/channel/${bcsChannelID}/videos/short?filter=%5B%7B%22name%22%3A%22VISIBILITY%22%2C%22value%22%3A%5B%22PUBLIC%22%5D%7D%5D&sort=%7B%22columnType%22%3A%22date%22%2C%22sortOrder%22%3A%22DESCENDING%22%7D`,
			icon: "icons/shorts.svg",
		},
		{
			key: "shortsScheduled",
			title: "Scheduled shorts",
			href: `https://studio.youtube.com/channel/${bcsChannelID}/videos/short?filter=%5B%7B%22name%22%3A%22VISIBILITY%22%2C%22value%22%3A%5B%22HAS_SCHEDULE%22%5D%7D%5D&sort=%7B%22columnType%22%3A%22date%22%2C%22sortOrder%22%3A%22ASCENDING%22%7D`,
			icon: "icons/shorts_scheduled.svg",
		},
		{
			key: "postsPublic",
			title: "Most recently posted (visible) posts",
			href: `https://studio.youtube.com/channel/${bcsChannelID}/content/posts?filter=%5B%7B%22name%22%3A%22VISIBILITY%22%2C%22value%22%3A%5B%22PUBLISHED%22%5D%7D%5D&sort=%7B%22columnType%22%3A%22date%22%2C%22sortOrder%22%3A%22DESCENDING%22%7D`,
			icon: "icons/posts.svg",
		},
		{
			key: "postsScheduled",
			title: "Scheduled posts",
			href: `https://studio.youtube.com/channel/${bcsChannelID}/content/posts?filter=%5B%7B%22name%22%3A%22VISIBILITY%22%2C%22value%22%3A%5B%22SCHEDULED%22%5D%7D%5D&sort=%7B%22columnType%22%3A%22date%22%2C%22sortOrder%22%3A%22ASCENDING%22%7D`,
			icon: "icons/posts scheduled.svg",
		},
		{
			key: "analytics",
			title: "Live analytics",
			icon: "icons/analytics.svg",
		},
		{
			key: "advancedAnalytics",
			title: "Advanced analytics",
			icon: "icons/adv.png",
		}
	];

	function runtimeUrl(path) {
		try {
			return chrome.runtime.getURL(path);
		} catch (e) {
			return path; // fallback for non-extension environments
		}
	}

	async function injectBaseStyles() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;

		try {
			const cssUrl = chrome.runtime.getURL("styles/main.css");
			const response = await fetch(cssUrl);
			let css = await response.text();
			// Replace placeholder with actual PANEL_ID
			css = css.replace(/__PANEL_ID__/g, PANEL_ID);
			style.textContent = css;
		} catch (err) {
			console.error("[BCS] Failed to load CSS:", err);
			// Minimal fallback CSS - just enough to show the panel
			style.textContent = `
			/* Minimal fallback - CSS file failed to load */
			#${PANEL_ID} {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				height: 40px;
				padding: 0 8px;
				background: var(--bcs-panel-bg, #1f1f1f);
				color: #e6e6e6;
				border-radius: 18px;
				border: 1px solid rgba(255,255,255,0.08);
				box-shadow: 0 2px 6px rgba(0,0,0,0.25);
				font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
			}
			nav.vidiq-scope > #${PANEL_ID} { display: inline-flex !important; }
		`;
		}

		document.documentElement.appendChild(style);
	}

	function goToLink(linkKey) {
		const link = LINKS.find(link => link.key === linkKey);
		if (link) {
			if (link.key === "analytics") {
				window.location.href = makeLiveAnalyticsLink();
			} else if (link.key === "advancedAnalytics") {
				window.location.href = makeAdvancedAnalyticsLink();
			} else {
				window.location.href = link.href;
			}
		}
	}

	function buildPanel() {
		const wrap = document.createElement("div");
		wrap.id = PANEL_ID;
		wrap.setAttribute("role", "toolbar");

		LINKS.forEach((link) => {
			const a = document.createElement("a");
			a.className = "bcs-btn";
			a.href = "#";
			a.addEventListener("click", () => goToLink(link.key));

			a.title = link.title;
			a.setAttribute("aria-label", link.title);
			const img = document.createElement("img");
			img.src = runtimeUrl(link.icon);
			img.alt = link.title;
			a.appendChild(img);
			wrap.appendChild(a);
		});

		return wrap;
	}
	function makeLiveAnalyticsLink() {
		if (bcsArtistID) {
			return `https://studio.youtube.com/artist/${bcsArtistID}/analytics/tab-overview/period-default/total_reach-all/explore?entity_type=ARTIST&entity_id=${bcsArtistID}&time_period=4_weeks&total_reach_state=all&explore_type=LATEST_ACTIVITY`;
		}
		if (bcsChannelID) {
			return `https://studio.youtube.com/channel/${bcsChannelID}/analytics/tab-overview/period-default/explore?entity_type=CHANNEL&entity_id=${bcsChannelID}&time_period=4_weeks&explore_type=LATEST_ACTIVITY`;
		}
		if (bcsExternalChannelID) {
			return `https://studio.youtube.com/channel/${bcsExternalChannelID}/analytics/tab-overview/period-default/explore?entity_type=CHANNEL&entity_id=${bcsExternalChannelID}&time_period=4_weeks&explore_type=LATEST_ACTIVITY`;
		}
		return null;
	}
	function makeAdvancedAnalyticsLink() {
		if (bcsArtistID) {
			return `https://studio.youtube.com/artist/${bcsArtistID}/analytics/tab-overview/period-default/total_reach-all/explore?entity_type=ARTIST&entity_id=${bcsArtistID}&time_period=4_weeks&total_reach_state=all&explore_type=TABLE_AND_CHART&metric=EXTERNAL_VIEWS&granularity=DAY&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS_VTR&dimension=VIDEO&o_column=EXTERNAL_VIEWS&o_direction=ANALYTICS_ORDER_DIRECTION_DESC`;
		}
		if (bcsChannelID) {
			return `https://studio.youtube.com/channel/${bcsChannelID}/analytics/tab-overview/period-default/explore?entity_type=CHANNEL&entity_id=${bcsChannelID}&time_period=4_weeks&explore_type=TABLE_AND_CHART&metric=EXTERNAL_VIEWS&granularity=DAY&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS_VTR&dimension=VIDEO&o_column=EXTERNAL_VIEWS&o_direction=ANALYTICS_ORDER_DIRECTION_DESC`;
		}
		if (bcsExternalChannelID) {
			return `https://studio.youtube.com/channel/${bcsExternalChannelID}/analytics/tab-overview/period-default/explore?entity_type=CHANNEL&entity_id=${bcsExternalChannelID}&time_period=4_weeks&explore_type=TABLE_AND_CHART&metric=EXTERNAL_VIEWS&granularity=DAY&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS_VTR&dimension=VIDEO&o_column=EXTERNAL_VIEWS&o_direction=ANALYTICS_ORDER_DIRECTION_DESC`;
		}
		return null;
	}

	function findHeaderContainer() {
		const vidiqNav = document.querySelector("ytcp-omnisearch");
		if (vidiqNav) return vidiqNav; // we'll inject as a direct child; CSS hides others but shows our panel

		// Fallback to the direct wrapper div inside omnisearch
		const omni = document.querySelector("ytcp-omnisearch");
		if (!omni) return null;
		const directDiv = omni.querySelector(":scope > div");
		return directDiv || omni;
	}

	function normalizeTitleForMatch(title) {
		if (!title) return "";
		return String(title)
			.replace(/\s+/g, " ")
			.trim()
			.toLowerCase();
	}



	function updateJoinVideoCache(list) {
		if (!Array.isArray(list) || !list.length) return;
		const seenIds = new Set();
		list.forEach((item) => {
			if (!item) return;
			const metrics = item.metrics || {};
			const videoId = item.videoId || item.videoKey || null;
			const title = item.title || item.videoTitle || "";

			// Extract thumbnail URL (prefer mqdefault or first available)
			let thumbnailUrl = null;
			if (item.thumbnailDetails?.thumbnails) {
				const thumbnails = item.thumbnailDetails.thumbnails;
				// Prefer mqdefault (medium quality), fallback to first
				const mqThumb = thumbnails.find(t => t.url?.includes('mqdefault') || t.url?.includes('mq2'));
				thumbnailUrl = mqThumb?.url || thumbnails[0]?.url || null;
			}

			const viewCount = Number(metrics.viewCount ?? item.viewCount ?? 0);
			const dislikeCount = Number(metrics.dislikeCount ?? item.dislikeCount ?? 0);

			const oldEntry = bcsJoinVideoIdMap.get(videoId);
			const oldCommentCount = oldEntry ? oldEntry.commentCount : null;
			const oldLikeCount = oldEntry ? oldEntry.likeCount : null;

			const entry = {
				videoId,
				title,
				thumbnailUrl,
				likeCount: Number(metrics.likeCount ?? item.likeCount ?? 0),
				commentCount: Number(metrics.commentCount ?? item.commentCount ?? 0),
				dislikeCount: dislikeCount,
				viewCount: viewCount,
				timePublishedSeconds: item.timePublishedSeconds || null,
			};

			if (videoId && seenIds.has(videoId)) return;
			if (videoId) {
				seenIds.add(videoId);

				// Check for changes and queue toasts
				if (oldEntry) {
					if (oldCommentCount !== null && entry.commentCount > oldCommentCount) {
						queueToast({
							videoId,
							title: entry.title,
							thumbnailUrl: thumbnailUrl,
							type: 'comments',
							oldCount: oldCommentCount,
							newCount: entry.commentCount,
						});
					}
					if (oldLikeCount !== null && entry.likeCount > oldLikeCount) {
						queueToast({
							videoId,
							title: entry.title,
							thumbnailUrl: thumbnailUrl,
							type: 'likes',
							oldCount: oldLikeCount,
							newCount: entry.likeCount,
						});
					}
				}

				// Index by video ID (new method)
				bcsJoinVideoIdMap.set(videoId, entry);
			}
			// Keep old title-based indexing for backward compatibility
			const normTitle = normalizeTitleForMatch(title);
			if (normTitle) bcsJoinVideoTitleMap.set(normTitle, entry);
		});
	}

	// Load cached subscriber node from storage
	function loadCachedSubscriberNode() {
		try {
			// Try localStorage first (as per user's changes)
			if (typeof localStorage !== "undefined") {
				const cachedNodeStr = localStorage.getItem("bcsCachedSubscriberNode");
				const cachedCount = localStorage.getItem("bcsSubscriberCount");

				if (cachedNodeStr) {
					try {
						const node = JSON.parse(cachedNodeStr);
						if (typeof window !== "undefined") {
							window.__bcsCachedSubscriberNode = node;
						}
					} catch (e) {
						console.log("Error parsing cached subscriber node:", e);
					}
				}

				if (cachedCount) {
					bcsSubscriberCount = Number(cachedCount);
				}
			}

			// Also try chrome.storage as fallback
			if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
				chrome.storage.local.get(["bcsCachedSubscriberNode", "bcsSubscriberCount"], (result) => {
					if (result.bcsCachedSubscriberNode && !localStorage.getItem("bcsCachedSubscriberNode")) {
						try {
							const node = JSON.parse(result.bcsCachedSubscriberNode);
							if (typeof window !== "undefined") {
								window.__bcsCachedSubscriberNode = node;
							}
							// Also save to localStorage for consistency
							//localStorage.setItem("bcsCachedSubscriberNode", result.bcsCachedSubscriberNode);
						} catch (e) {
							console.log("Error loading cached subscriber node:", e);
						}
					}
					if (result.bcsSubscriberCount !== undefined && result.bcsSubscriberCount !== null && !bcsSubscriberCount) {
						bcsSubscriberCount = Number(result.bcsSubscriberCount);
					}
				});
			}

			// Update dashboard if on analytics page
			if (isAnalyticsPage() && bcsCustomTableContainer && bcsSubscriberCount !== null) {
				scheduleAnalyticsSync();
			}
		} catch (e) {
			console.log("Error accessing storage:", e);
		}
	}

	function handleJoinPayload(payload) {
		try {
			const results = payload?.results;

			if (!Array.isArray(results)) return;
			const videos = [];
			let minutelyData = null;
			let hourlyData = null;
			let subscriberNode = null;
			let earningsData = null;

			results.forEach((node) => {
				if (node.key === "0__TOP_VIDEO_META") {
					const getVideos = node?.value?.getCreatorVideos?.videos;
					if (Array.isArray(getVideos)) videos.push(...getVideos);
				} else if (node.key === "0__MINUTELY_PER_VIDEO") {
					minutelyData = node?.value?.resultTable;
				} else if (node.key === "0__HOURLY_PER_VIDEO") {
					hourlyData = node?.value?.resultTable;
				} else if (node.key === "2__TOP_ENTITIES_TABLE_QUERY_KEY") {
					earningsData = node?.value?.resultTable;
				} else if (node.key === "0__CUMULATIVE_SUBSCRIBERS_KEY") {
					subscriberNode = node;
					// Process subscriber data
					try {
						const cardData = node?.value?.getCards?.cards?.[0]?.cumulativeSubscribersCardData;
						if (cardData) {
							// Extract lifetime total
							const lifetimeTotal = cardData.lifetimeTotal;
							if (lifetimeTotal !== undefined && lifetimeTotal !== null) {
								bcsPreviousSubscriberCount = bcsSubscriberCount;
								const newCount = Number(lifetimeTotal);
								if (newCount > (bcsSubscriberCount || 0)) {
									trackSubscriberChange(newCount);
								}
								bcsSubscriberCount = newCount;
							}

							// Extract time series data for sparkline
							const tableData = cardData.tableData;
							if (tableData && tableData.dimensionColumns && tableData.metricColumns) {
								const dateIds = tableData.dimensionColumns[0]?.dateIds?.values || [];
								const counts = tableData.metricColumns[0]?.counts?.values || [];

								if (dateIds.length === counts.length && dateIds.length > 0) {
									bcsSubscriberHistory = dateIds.map((dateId, idx) => ({
										dateId,
										count: Number(counts[idx]) || 0
									}));
								}
							}
						}

						// Only cache if this is a single-node response (from SUBSCRIBERS page)
						if (results.length === 1) {
							try {
								const clonedNode = JSON.parse(JSON.stringify(node));
								//localStorage.setItem("bcsCachedSubscriberNode", JSON.stringify(clonedNode));
								if (bcsSubscriberCount !== null) {
									localStorage.setItem("bcsSubscriberCount", String(bcsSubscriberCount));
								}
							} catch (e) {
								console.log("Error caching subscriber node:", e);
							}
						}
					} catch (e) {
						console.log("Error processing subscriber node:", e);
					}
				}
			});

			if (videos.length) {
				updateJoinVideoCache(videos);
			}

			if (hourlyData) {
				processHourlyData(hourlyData);
			}

			if (minutelyData) {
				processMinutelyData(minutelyData);
			}

			if (earningsData) {
				processVideoMetricsData(earningsData);
			}

			// Update custom table when new data arrives
			if (isAnalyticsPage() && (videos.length || minutelyData || hourlyData || subscriberNode || earningsData)) {
				scheduleAnalyticsSync();
			}

			// Also update if subscriber data changed
			if (subscriberNode && isAnalyticsPage()) {
				scheduleAnalyticsSync();
			}
		} catch (e) {
			console.log("Error handling JOIN payload:", e);
		}
	}

	function processHourlyData(resultTable) {
		try {
			if (!resultTable?.dimensionColumns || !resultTable?.metricColumns) return;

			const dimensionColumns = resultTable.dimensionColumns;
			const metricColumns = resultTable.metricColumns;

			// Find VIDEO and HOUR dimension columns
			let videoColumn = null;
			let hourColumn = null;
			let viewCountColumn = null;

			dimensionColumns.forEach((col, idx) => {
				if (col.dimension?.type === "VIDEO") {
					videoColumn = idx;
				} else if (col.dimension?.type === "HOUR") {
					hourColumn = idx;
				}
			});

			metricColumns.forEach((col) => {
				if (col.metric?.type === "EXTERNAL_VIEWS") {
					viewCountColumn = col.counts?.values;
				}
			});

			if (videoColumn === null || hourColumn === null || !viewCountColumn) return;

			const videoIds = dimensionColumns[videoColumn].strings?.values || [];
			const timestamps = dimensionColumns[hourColumn].timestamps?.values || [];
			const viewCounts = viewCountColumn;

			if (videoIds.length !== timestamps.length || timestamps.length !== viewCounts.length) {
				console.log("Hourly data length mismatch:", { videoIds: videoIds.length, timestamps: timestamps.length, viewCounts: viewCounts.length });
				return;
			}

			// Group data by video ID
			const videoDataMap = new Map();

			for (let i = 0; i < videoIds.length; i++) {
				const videoId = videoIds[i];
				const timestamp = timestamps[i];
				const count = Number(viewCounts[i]) || 0;

				if (!videoDataMap.has(videoId)) {
					videoDataMap.set(videoId, []);
				}

				videoDataMap.get(videoId).push({
					timestamp,
					count
				});
			}

			// Update view history for each video - merge with existing hourly data
			videoDataMap.forEach((dataPoints, videoId) => {
				// Sort by timestamp
				dataPoints.sort((a, b) => a.timestamp - b.timestamp);

				const existingHistory = bcsViewHistory.get(videoId) || {};
				const existingHourly = existingHistory.hourly;

				if (existingHourly && existingHourly.timestamps && existingHourly.counts) {
					// Merge: combine existing and new data, remove duplicates
					const existingMap = new Map();

					// Add existing data
					for (let i = 0; i < existingHourly.timestamps.length; i++) {
						existingMap.set(existingHourly.timestamps[i], existingHourly.counts[i]);
					}

					// Add/update with new data
					dataPoints.forEach(point => {
						existingMap.set(point.timestamp, point.count);
					});

					// Convert back to arrays, sorted by timestamp
					const combined = [];
					existingMap.forEach((count, timestamp) => {
						combined.push({ timestamp, count });
					});
					combined.sort((a, b) => a.timestamp - b.timestamp);

					// Keep only last 48 hours to prevent memory issues
					const now = Date.now();
					const cutoff48h = now - (48 * 60 * 60 * 1000);
					const filtered = combined.filter(d => d.timestamp >= cutoff48h);

					bcsViewHistory.set(videoId, {
						...existingHistory,
						hourly: {
							timestamps: filtered.map(d => d.timestamp),
							counts: filtered.map(d => d.count),
						}
					});
				} else {
					// First time, just store it
					const timestamps = dataPoints.map(d => d.timestamp);
					const counts = dataPoints.map(d => d.count);

					bcsViewHistory.set(videoId, {
						...existingHistory,
						hourly: {
							timestamps,
							counts,
						}
					});
				}
			});
		} catch (e) {
			console.log("Error processing hourly data:", e);
		}
	}

	function processMinutelyData(resultTable) {
		try {
			if (!resultTable?.dimensionColumns || !resultTable?.metricColumns) return;

			const dimensionColumns = resultTable.dimensionColumns;
			const metricColumns = resultTable.metricColumns;

			// Find VIDEO and MINUTE dimension columns
			let videoColumn = null;
			let minuteColumn = null;
			let viewCountColumn = null;

			dimensionColumns.forEach((col, idx) => {
				if (col.dimension?.type === "VIDEO") {
					videoColumn = idx;
				} else if (col.dimension?.type === "MINUTE") {
					minuteColumn = idx;
				}
			});

			metricColumns.forEach((col) => {
				if (col.metric?.type === "EXTERNAL_VIEWS") {
					viewCountColumn = col.counts?.values;
				}
			});

			if (videoColumn === null || minuteColumn === null || !viewCountColumn) return;

			const videoIds = dimensionColumns[videoColumn].strings?.values || [];
			const timestamps = dimensionColumns[minuteColumn].timestamps?.values || [];
			const viewCounts = viewCountColumn;

			if (videoIds.length !== timestamps.length || timestamps.length !== viewCounts.length) {
				console.log("Minutely data length mismatch:", { videoIds: videoIds.length, timestamps: timestamps.length, viewCounts: viewCounts.length });
				return;
			}

			// Group data by video ID
			const videoDataMap = new Map();

			for (let i = 0; i < videoIds.length; i++) {
				const videoId = videoIds[i];
				const timestamp = timestamps[i];
				const count = Number(viewCounts[i]) || 0;

				if (!videoDataMap.has(videoId)) {
					videoDataMap.set(videoId, []);
				}

				videoDataMap.get(videoId).push({
					timestamp,
					count
				});
			}

			// Update view history for each video - merge with existing minutely data
			videoDataMap.forEach((dataPoints, videoId) => {
				// Sort by timestamp
				dataPoints.sort((a, b) => a.timestamp - b.timestamp);

				const existingHistory = bcsViewHistory.get(videoId) || {};
				const existingMinutely = existingHistory.minutely;

				if (existingMinutely && existingMinutely.timestamps && existingMinutely.counts) {
					// Merge: combine existing and new data, remove duplicates
					const existingMap = new Map();

					// Add existing data
					for (let i = 0; i < existingMinutely.timestamps.length; i++) {
						existingMap.set(existingMinutely.timestamps[i], existingMinutely.counts[i]);
					}

					// Add/update with new data
					dataPoints.forEach(point => {
						existingMap.set(point.timestamp, point.count);
					});

					// Convert back to arrays, sorted by timestamp
					const combined = [];
					existingMap.forEach((count, timestamp) => {
						combined.push({ timestamp, count });
					});
					combined.sort((a, b) => a.timestamp - b.timestamp);

					// Keep only last 60 minutes to prevent memory issues
					const now = Date.now();
					const cutoff60m = now - (60 * 60 * 1000);
					const filtered = combined.filter(d => d.timestamp >= cutoff60m);

					bcsViewHistory.set(videoId, {
						...existingHistory,
						minutely: {
							timestamps: filtered.map(d => d.timestamp),
							counts: filtered.map(d => d.count),
						}
					});
				} else {
					// First time, just store it
					const timestamps = dataPoints.map(d => d.timestamp);
					const counts = dataPoints.map(d => d.count);

					bcsViewHistory.set(videoId, {
						...existingHistory,
						minutely: {
							timestamps,
							counts,
						}
					});
				}
			});
		} catch (e) {
			console.log("Error processing minutely data:", e);
		}
	}

	function processVideoMetricsData(resultTable) {
		try {
			if (!resultTable?.dimensionColumns || !resultTable?.metricColumns) return;

			const dimensionColumns = resultTable.dimensionColumns;
			const metricColumns = resultTable.metricColumns;

			// Find VIDEO dimension column
			let videoColumn = null;
			let earningsColumn = null;
			let subscriberNetChangeColumn = null;
			let watchTimeColumn = null;
			let ctrColumn = null;

			dimensionColumns.forEach((col, idx) => {
				if (col.dimension?.type === "VIDEO") {
					videoColumn = idx;
				}
			});

			// Find all metric columns
			metricColumns.forEach((col) => {
				const metricType = col.metric?.type;
				if (metricType === "TOTAL_ESTIMATED_EARNINGS" &&
					col.metric?.asPercentagesOfTotal === false &&
					col.earnings?.values) {
					earningsColumn = col.earnings.values;
				} else if (metricType === "SUBSCRIBERS_NET_CHANGE" && col.counts?.values) {
					subscriberNetChangeColumn = col.counts.values;
				} else if (metricType === "EXTERNAL_WATCH_TIME") {
					// Use milliseconds for watch time
					if (col.milliseconds?.values) {
						watchTimeColumn = col.milliseconds.values;
					}
					// Get total from milliseconds.total
					if (col.milliseconds?.total !== undefined && col.milliseconds?.total !== null) {
						bcsTotalWatchTime = Number(col.milliseconds.total) || 0;
					}
				} else if (metricType === "VIDEO_THUMBNAIL_IMPRESSIONS_VTR" && col.percentages?.values) {
					ctrColumn = col.percentages.values;
				}
			});

			if (videoColumn === null) return;

			const videoIds = dimensionColumns[videoColumn].strings?.values || [];
			if (videoIds.length === 0) return;

			// Process all metrics for each video
			for (let i = 0; i < videoIds.length; i++) {
				const videoId = videoIds[i];

				// Earnings
				if (earningsColumn && earningsColumn[i] !== undefined) {
					const earningsValue = Number(earningsColumn[i]) || 0;
					const earningsDollars = Math.round(earningsValue) / 1000;
					bcsVideoEarnings.set(videoId, earningsDollars);
				}

				// Subscriber net change
				if (subscriberNetChangeColumn && subscriberNetChangeColumn[i] !== undefined) {
					bcsVideoSubscriberNetChange.set(videoId, Number(subscriberNetChangeColumn[i]) || 0);
				}

				// Engaged views


				// External watch time (in milliseconds)
				if (watchTimeColumn && watchTimeColumn[i] !== undefined) {
					const watchTime = Number(watchTimeColumn[i]) || 0;
					bcsVideoWatchTime.set(videoId, watchTime);
				}

				// CTR (VIDEO_THUMBNAIL_IMPRESSIONS_VTR) - percentage
				if (ctrColumn && ctrColumn[i] !== undefined) {
					bcsVideoCTR.set(videoId, Number(ctrColumn[i]) || 0);
				}
			}
		} catch (e) {
			console.log("Error processing video metrics data:", e);
		}
	}

	function ensureToastContainer() {
		if (bcsToastContainer && document.body.contains(bcsToastContainer)) {
			return bcsToastContainer;
		}
		bcsToastContainer = document.getElementById("bcs-toast-container");
		if (!bcsToastContainer) {
			bcsToastContainer = document.createElement("div");
			bcsToastContainer.id = "bcs-toast-container";
			document.body.appendChild(bcsToastContainer);
		}
		return bcsToastContainer;
	}

	function truncateTitle(title, maxLength = 20) {
		if (!title) return "";
		if (title.length <= maxLength) return title;
		return title.substring(0, maxLength) + "...";
	}

	function queueToast(toastData) {
		if (!toastData || !toastData.videoId) return;

		// Limit queue size to 20
		if (bcsToastQueue.length >= 20) {
			// Remove oldest
			bcsToastQueue.shift();
		}

		bcsToastQueue.push(toastData);
		processToastQueue();
	}

	function processToastQueue() {
		if (bcsToastQueue.length === 0) return;

		const container = ensureToastContainer();
		if (!container) return;

		// Check how many are currently visible (including ones that are animating in)
		const existingToasts = container.querySelectorAll(".bcs-toast");
		const visibleToasts = container.querySelectorAll(".bcs-toast.bcs-toast-show");
		const visibleCount = visibleToasts.length;
		const maxVisible = 10;
		const availableSlots = maxVisible - visibleCount;

		if (availableSlots <= 0) {
			// Wait for a toast to finish before showing more
			setTimeout(() => {
				processToastQueue();
			}, 500);
			return;
		}

		// Show up to availableSlots toasts immediately, all at once
		const toastsToShow = Math.min(availableSlots, bcsToastQueue.length);
		const promises = [];

		for (let i = 0; i < toastsToShow; i++) {
			const toastData = bcsToastQueue.shift();
			if (!toastData) break;

			// Show all toasts immediately without waiting
			promises.push(showToast(toastData));
		}

		// After showing this batch, check if there are more in queue
		Promise.all(promises).then(() => {
			// Small delay then process next batch if available
			if (bcsToastQueue.length > 0) {
				setTimeout(() => {
					processToastQueue();
				}, 100);
			}
		});
	}

	function showToast(toastData) {
		return new Promise((resolve) => {
			const container = ensureToastContainer();
			if (!container) {
				resolve();
				return;
			}

			// Limit visible toasts to 10
			const existingToasts = container.querySelectorAll(".bcs-toast.bcs-toast-show");
			if (existingToasts.length >= 10) {
				// Remove oldest visible toast
				const oldest = existingToasts[0];
				if (oldest) {
					removeToast(oldest);
				}
			}

			const toast = document.createElement("div");
			toast.className = "bcs-toast";

			const title = truncateTitle(toastData.title, 20);
			const increase = (toastData.newCount || 0) - (toastData.oldCount || 0);
			const message = toastData.type === 'comments'
				? `${increase} new comment${increase !== 1 ? 's' : ''} on`
				: `${increase} new like${increase !== 1 ? 's' : ''} on`;

			// Get thumbnail URL - try from cache first, then use provided
			let thumbnailUrl = toastData.thumbnailUrl;
			if (!thumbnailUrl && toastData.videoId) {
				const cached = bcsJoinVideoIdMap.get(toastData.videoId);
				if (cached?.thumbnailUrl) {
					thumbnailUrl = cached.thumbnailUrl;
				}
			}

			// Fallback: construct thumbnail URL from video ID
			if (!thumbnailUrl && toastData.videoId) {
				thumbnailUrl = `https://i9.ytimg.com/vi/${toastData.videoId}/mqdefault.jpg`;
			}

			toast.innerHTML = `
				${thumbnailUrl ? `<img src="${thumbnailUrl}" class="bcs-toast-thumb" alt="Video thumbnail">` : ''}
				<div class="bcs-toast-content">
					<div class="bcs-toast-text">${message}</div>
					<div class="bcs-toast-title">${title}</div>
				</div>
			`;

			container.appendChild(toast);

			// Trigger animation
			requestAnimationFrame(() => {
				toast.classList.add("bcs-toast-show");
			});

			// Auto-remove after 4 seconds
			setTimeout(() => {
				removeToast(toast);
				resolve();
			}, 4000);
		});
	}

	function removeToast(toast) {
		if (!toast || !toast.parentElement) return;
		toast.classList.remove("bcs-toast-show");
		setTimeout(() => {
			if (toast.parentElement) {
				toast.remove();
			}
		}, 300);
	}

	function installJoinInterceptor() {
		if (bcsJoinInterceptorInstalled) return;
		bcsJoinInterceptorInstalled = true;
		try {
			window.addEventListener("message", (ev) => {
				try {
					const data = ev?.data;
					if (!data || data.source !== "bcs" || data.type !== "JOIN_PAYLOAD")
						return;
					if (data.payload) {

						handleJoinPayload(data.payload);
					}
				} catch (_) { }
			});
			window.addEventListener("message", (ev) => {
				try {
					const data = ev?.data;
					if (!data || data.source !== "bcs" || data.type !== "IDS")
						return;
					if (data.payload) {

						handleIDS(data.payload);
					}
				} catch (_) { }
			});
		} catch (_) { }
		try {
			if (document.getElementById("bcs-join-hook")) return;
			const sx = document.createElement("script");
			sx.id = "bcs-join-hook";
			sx.src = chrome.runtime.getURL("inject.js");
			// Pass queries.json URL to inject.js
			sx.setAttribute("data-queries-url", chrome.runtime.getURL("data/queries.json"));
			(document.documentElement || document.head).appendChild(sx);
		} catch (_) { }
	}

	function handleIDS(payload) {
		bcsArtistID = payload.artistID || null;
		bcsChannelID = payload.channelID || null;
		bcsExternalChannelID = payload.externalChannelID || null;
	}

	function isAnalyticsPage() {
		return location.href.includes("/analytics") && location.href.includes("/explore") && location.href.includes("&explore_type=LATEST_ACTIVITY");
	}

	function applyAnalyticsStyles() {
		if (!isAnalyticsPage()) {
			const old = document.getElementById(ANALYTICS_STYLE_ID);
			if (old) old.remove();
			return;
		}
		let style = document.getElementById(ANALYTICS_STYLE_ID);
		if (!style) {
			style = document.createElement("style");
			style.id = ANALYTICS_STYLE_ID;
			document.documentElement.appendChild(style);
		}
		style.textContent = `
			/* Chart bars */
			path.bar.style-scope.yta-line-chart-base { fill: #FF0000 !important; }
			yta-tiny-chart.style-scope.yta-explore-latest-activity-row { --chart-fill-color: #FF0000 !important; }
			/* Background (analytics pages only) */
			html body { background-color: #000000 !important; }
		`;
	}

	function ensurePanelInjected() {
		const container = findHeaderContainer();
		if (!container) return false;
		if (!document.getElementById(PANEL_ID)) {
			const panel = buildPanel();
			try {
				container.prepend(panel);
			} catch (_) {
				console.warn("[Studio Quick Panel] Failed to inject panel.");
				return false;
			}
		}
		return true;
	}

	function replaceStudioLogo() {
		try {
			const img =
				document.querySelector(
					"a#home-button img.style-scope.ytcp-home-button"
				) || document.querySelector("a#home-button img");
			if (img) {
				img.src = runtimeUrl("icons/logo.svg");
				img.srcset = "";
				img.alt = "Studio";
			}
		} catch (_) {
			/* no-op */
		}
	}

	function installHistoryListeners() {
		// React to SPA navigations
		const origPush = history.pushState;
		const origReplace = history.replaceState;
		function onNavChange() {
			setTimeout(() => {
				ensurePanelInjected();
				applyAnalyticsStyles();
				replaceStudioLogo();
				injectHeaderSettingsButton();
				// Re-setup analytics observer if on analytics page
				setupAnalyticsObserver();
				// Build/update custom table when navigating to analytics page
				if (isAnalyticsPage()) {
					setTimeout(() => {
						buildCustomTable();
						if (bcsJoinVideoIdMap.size > 0) {
							scheduleAnalyticsSync();
						}
						// Initialize Electron backend if enabled
						if (bcsElectronBackendEnabled) {
							initElectronBackendConnection();
						}
					}, 300);
				} else {
					// Disconnect when leaving analytics page
					if (bcsElectronBackendEnabled) {
						disconnectElectronBackend();
					}
				}
			}, 50);
		}
		history.pushState = function () {
			const r = origPush.apply(this, arguments);
			onNavChange();
			return r;
		};
		history.replaceState = function () {
			const r = origReplace.apply(this, arguments);
			onNavChange();
			return r;
		};
		window.addEventListener("popstate", onNavChange);
	}

	function updateSeeMoreButton() {
		// Find the specific "See more" button using the full context:
		// It's inside ytcp-ve.yta-card-container and the link has explore_type=LATEST_ACTIVITY
		const cardContainers = document.querySelectorAll('ytcp-ve.style-scope.yta-card-container');
		for (const container of cardContainers) {
			const link = container.querySelector('a#see-more-link[href*="explore_type=LATEST_ACTIVITY"]');
			if (link) {
				const seeMoreButton = link.querySelector('ytcp-button#see-more-button');
				if (seeMoreButton) {
					const textContent = seeMoreButton.querySelector('.ytcpButtonShapeImpl__button-text-content');
					if (textContent && textContent.textContent.trim() === 'See more') {
						textContent.textContent = 'Open Dashboard';
					}

					// Update aria-label on the button
					const button = seeMoreButton.querySelector('button[aria-label="See more"]');
					if (button) {
						button.setAttribute('aria-label', 'Open Dashboard');
						button.setAttribute('title', 'Open Dashboard');
					}
				}

				// Update the link aria-label as well
				if (link.getAttribute('aria-label') === 'See more') {
					link.setAttribute('aria-label', 'Open Dashboard');
				}
				break; // Found the right one, stop searching
			}
		}
	}

	// Inject settings button in header next to notifications
	function injectHeaderSettingsButton() {
		// Try to find notifications button or header container
		// Common selectors for YouTube Studio header buttons
		const headerSelectors = [
			'div.ytcpAppHeaderIconsSection',

		];

		let headerContainer = null;
		let notificationsButton = null;

		// Try to find header container
		for (const selector of headerSelectors) {
			headerContainer = document.querySelector(selector);
			if (headerContainer) break;
		}

		// Try to find notifications button
		const notificationSelectors = [
			'ytcp-icon-button[aria-label*="notification" i]',
			'ytcp-icon-button[aria-label*="Notification" i]',
			'button[aria-label*="notification" i]',
			'button[aria-label*="Notification" i]',
			'ytcp-app-header ytcp-icon-button:last-of-type',
			'ytcp-app-header > div:last-child ytcp-icon-button'
		];

		for (const selector of notificationSelectors) {
			notificationsButton = document.querySelector(selector);
			if (notificationsButton) break;
		}

		// If we found notifications button, insert settings button next to it
		if (headerContainer) {
			// Fallback: add to header container
			if (document.getElementById('bcs-header-settings-btn')) return;

			const settingsBtn = document.createElement('button');
			settingsBtn.id = 'bcs-header-settings-btn';
			settingsBtn.className = 'bcs-header-settings-btn';
			settingsBtn.innerHTML = '⚙';
			settingsBtn.title = 'Settings';
			settingsBtn.setAttribute('aria-label', 'Settings');
			settingsBtn.style.cssText = `
				width: 40px;
				height: 40px;
				border-radius: 50%;
				border: none;
				background: transparent;
				color: rgba(255, 255, 255, 0.9);
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 20px;
				transition: all 0.2s ease;
				margin: 0 4px;
			`;
			settingsBtn.addEventListener('mouseenter', () => {
				settingsBtn.style.background = 'rgba(255, 255, 255, 0.1)';
				settingsBtn.style.color = '#ffffff';
			});
			settingsBtn.addEventListener('mouseleave', () => {
				settingsBtn.style.background = 'transparent';
				settingsBtn.style.color = 'rgba(255, 255, 255, 0.9)';
			});
			settingsBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				toggleSettingsPanel();
			});

			// Try to find the right side of header (where notifications usually are)

			headerContainer.appendChild(settingsBtn);
		}
	}

	async function init() {
		// Load settings first
		await loadSettings();

		// Apply settings
		applyHiddenElementsSettings();
		applyElectronBackendSettings();

		// Auto-connect to Electron backend if enabled
		if (bcsSettings.electronBackend.enabled && isAnalyticsPage()) {
			// Wait a bit for page to be ready
			setTimeout(() => {
				initElectronBackendConnection();
			}, 1000);
		}

		installJoinInterceptor();
		injectBaseStyles();
		ensurePanelInjected();
		applyAnalyticsStyles();
		replaceStudioLogo();
		installHistoryListeners();
		updateSeeMoreButton();
		injectHeaderSettingsButton();

		const observer = new MutationObserver(() => {
			// Throttle panel checks to prevent excessive DOM queries
			if (bcsPanelCheckTimeout) return;
			bcsPanelCheckTimeout = setTimeout(() => {
				bcsPanelCheckTimeout = null;
				ensurePanelInjected();
				replaceStudioLogo();
				updateSeeMoreButton();
				injectHeaderSettingsButton();
				// Build/update custom table on analytics page when DOM changes
				if (isAnalyticsPage()) {
					const hasTable = document.querySelector("#table.style-scope.yta-explore-latest-activity");
					if (hasTable && !bcsCustomTableContainer) {
						buildCustomTable();
					} else if (bcsCustomTableContainer) {
						// Only update if we have data
						if (bcsJoinVideoIdMap.size > 0) {
							scheduleAnalyticsSync();
						}
					}
				}
			}, 100);
		});
		observer.observe(document.documentElement, {
			childList: true,
			subtree: true,
		});

		// Setup analytics observer (will be re-initialized on navigation)
		setupAnalyticsObserver();
	}

	function setupAnalyticsObserver() {
		// Disconnect existing observer if any
		if (bcsAnalyticsObserver) {
			bcsAnalyticsObserver.disconnect();
			bcsAnalyticsObserver = null;
		}

		if (!isAnalyticsPage()) return;

		// Wait a bit for DOM to be ready
		setTimeout(() => {
			const analyticsContainer = document.querySelector("yta-explore-latest-activity, yta-explore-page");
			if (analyticsContainer && !bcsAnalyticsObserver) {
				bcsAnalyticsObserver = new MutationObserver(() => {
					// Check for error section and auto-refresh if found (only if visible, not hidden)
					const errorSection = document.querySelector("ytcp-error-section.yta-explore-page");
					if (errorSection && bcsCustomTableContainer && !errorSection.hasAttribute("hidden")) {
						console.log("[BCS] Error section detected, refreshing page...");
						setTimeout(() => {
							window.location.reload();
						}, 1000); // Wait 1 second before refreshing
						return;
					}

					// Build table if not exists, or update if it does
					const hasTable = document.querySelector("#table.style-scope.yta-explore-latest-activity");
					if (hasTable) {
						if (!bcsCustomTableContainer) {
							buildCustomTable();
						} else {
							// Update when data changes
							scheduleAnalyticsSync();
						}
					}
				});
				bcsAnalyticsObserver.observe(analyticsContainer, {
					childList: true,
					subtree: true,
					attributes: false,
					attributeOldValue: false,
				});
			}
		}, 200);
	}

	function formatNumber(n) {
		try {
			const num = Number(n);
			if (num >= 1000) {
				const kValue = (num / 1000).toFixed(1);
				return kValue.endsWith('.0') ? `${Math.floor(num / 1000)}k` : `${kValue}k`;
			}
			return new Intl.NumberFormat().format(n);
		} catch {
			return String(n);
		}
	}

	// Track metric change for hot streak detection
	function trackMetricChange(videoId, metricType, newValue) {
		if (!videoId || !metricType || newValue === null || newValue === undefined) return;

		const now = Date.now();
		if (!bcsMetricChangeHistory.has(videoId)) {
			bcsMetricChangeHistory.set(videoId, {});
		}
		const videoHistory = bcsMetricChangeHistory.get(videoId);
		if (!videoHistory[metricType]) {
			videoHistory[metricType] = [];
		}

		const history = videoHistory[metricType];
		const lastEntry = history[history.length - 1];

		// Only track if value increased
		if (!lastEntry || newValue > lastEntry.value) {
			history.push({ timestamp: now, value: newValue });
		}

		// Clean up old entries (older than 5 minutes)
		const fiveMinutesAgo = now - (5 * 60 * 1000);
		while (history.length > 0 && history[0].timestamp < fiveMinutesAgo) {
			history.shift();
		}
	}

	// Track subscriber count change
	function trackSubscriberChange(newValue) {
		if (newValue === null || newValue === undefined) return;

		const now = Date.now();
		const lastEntry = bcsSubscriberChangeHistory[bcsSubscriberChangeHistory.length - 1];

		// Only track if value increased
		if (!lastEntry || newValue > lastEntry.value) {
			bcsSubscriberChangeHistory.push({ timestamp: now, value: newValue });
		}

		// Clean up old entries (older than 5 minutes)
		const fiveMinutesAgo = now - (5 * 60 * 1000);
		while (bcsSubscriberChangeHistory.length > 0 && bcsSubscriberChangeHistory[0].timestamp < fiveMinutesAgo) {
			bcsSubscriberChangeHistory.shift();
		}
	}

	// Check if metric is on hot streak (5+ increases in 5 minutes)
	function isHotStreak(videoId, metricType) {
		if (!videoId || !metricType) return false;
		const videoHistory = bcsMetricChangeHistory.get(videoId);
		if (!videoHistory || !videoHistory[metricType]) return false;

		const { increases, timeWindowMinutes } = bcsSettings.hotStreak;
		const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);

		// Filter to only include increases within the time window
		const recentIncreases = videoHistory[metricType].filter(entry => entry.timestamp >= cutoffTime);

		return recentIncreases.length >= increases;
	}

	// Check if subscribers are on hot streak
	function isSubscriberHotStreak() {
		const { increases, timeWindowMinutes } = bcsSettings.hotStreak;
		const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
		const recentIncreases = bcsSubscriberChangeHistory.filter(entry => entry.timestamp >= cutoffTime);
		return recentIncreases.length >= increases;
	}

	function formatCurrency(amount) {
		try {
			return new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: 'USD',
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}).format(amount);
		} catch {
			return `$${amount.toFixed(2)}`;
		}
	}

	function formatWatchTime(milliseconds) {
		// Accepts milliseconds, converts to hours for display
		if (!milliseconds || milliseconds === 0) return "0";
		const seconds = Math.floor(milliseconds / 1000);
		const hours = Math.floor(seconds / 3600);

		if (hours >= 1000) {
			// Format as "1.7k" for >= 1000 hours
			const kValue = (hours / 1000).toFixed(1);
			return kValue.endsWith('.0') ? `${Math.floor(hours / 1000)}k` : `${kValue}k`;
		} else {
			// Just the number for < 1000 hours
			return String(hours);
		}
	}

	function formatWatchTimeDaysHoursMinutesSeconds(milliseconds) {
		if (!milliseconds || milliseconds === 0) return "0:00:00:00";
		const totalSeconds = Math.floor(milliseconds / 1000);
		const days = Math.floor(totalSeconds / 86400);
		const hours = Math.floor((totalSeconds % 86400) / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const secs = totalSeconds % 60;
		return `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}

	function formatCTR(percentage) {
		return `${percentage.toFixed(2)}%`;
	}

	// Get sparkline data from hourly counts (for 48h) and minutely counts (for 60m)
	function getSparklineData48h(videoId) {
		if (!bcsViewHistory.has(videoId)) return null;
		const history = bcsViewHistory.get(videoId);
		const hourly = history.hourly;
		if (!hourly || !hourly.timestamps || !hourly.counts) return null;

		const now = Date.now();
		const cutoff48h = now - (48 * 60 * 60 * 1000);

		const data = [];
		for (let i = 0; i < hourly.timestamps.length; i++) {
			if (hourly.timestamps[i] >= cutoff48h) {
				data.push(hourly.counts[i]);
			}
		}
		return data.length > 0 ? data : null;
	}

	function getSparklineData60m(videoId) {
		if (!bcsViewHistory.has(videoId)) return null;
		const history = bcsViewHistory.get(videoId);
		const minutely = history.minutely;
		if (!minutely || !minutely.timestamps || !minutely.counts) return null;

		const now = Date.now();
		const cutoff60m = now - (60 * 60 * 1000);

		const data = [];
		for (let i = 0; i < minutely.timestamps.length; i++) {
			if (minutely.timestamps[i] >= cutoff60m) {
				data.push(minutely.counts[i]);
			}
		}
		return data.length > 0 ? data : null;
	}

	function getViews48h(videoId) {
		const history = bcsViewHistory.get(videoId);
		if (!history) return 0;
		const hourly = history.hourly;
		if (!hourly || !hourly.timestamps || !hourly.counts || hourly.counts.length === 0) return 0;

		const now = Date.now();
		const cutoff48h = now - (48 * 60 * 60 * 1000);

		// Sum all hourly counts within the 48h window
		let total = 0;
		for (let i = 0; i < hourly.timestamps.length; i++) {
			if (hourly.timestamps[i] >= cutoff48h) {
				total += hourly.counts[i] || 0;
			}
		}
		return total;
	}

	function getViews60m(videoId) {
		const history = bcsViewHistory.get(videoId);
		if (!history) return 0;
		const minutely = history.minutely;
		if (!minutely || !minutely.timestamps || !minutely.counts || minutely.counts.length === 0) return 0;

		const now = Date.now();
		const cutoff60m = now - (60 * 60 * 1000);

		// Sum all minutely counts within the 60m window
		let total = 0;
		for (let i = 0; i < minutely.timestamps.length; i++) {
			if (minutely.timestamps[i] >= cutoff60m) {
				total += minutely.counts[i] || 0;
			}
		}
		return total;
	}

	// Create SVG sparkline
	function createSparklineSVG(data, width = 120, height = 32) {
		if (!data || data.length === 0) {
			return document.createElementNS("http://www.w3.org/2000/svg", "svg");
		}

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", width);
		svg.setAttribute("height", height);
		svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

		// Data is minute-by-minute counts - normalize for display
		const normalized = Array.isArray(data) && typeof data[0] === 'number'
			? data
			: data.map(p => typeof p === 'object' ? p.y : p);

		// Use raw counts for sparkline (shows activity per minute)
		// Find min/max for normalization
		const min = 0; // Always start from 0 for counts
		const max = Math.max(...normalized, 1); // At least 1 to avoid division by zero

		const points = normalized.map((count, i) => {
			const x = (i / (normalized.length - 1 || 1)) * width;
			const y = height - ((count / max) * height * 0.8) - height * 0.1;
			return `${x},${y}`;
		});

		// Create gradient definition
		const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
		const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
		gradient.setAttribute("id", `bcs-sparkline-gradient-${Date.now()}-${Math.random()}`);
		gradient.setAttribute("x1", "0%");
		gradient.setAttribute("y1", "0%");
		gradient.setAttribute("x2", "0%");
		gradient.setAttribute("y2", "100%");
		const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
		stop1.setAttribute("offset", "0%");
		stop1.setAttribute("stop-color", "#a957ff");
		stop1.setAttribute("stop-opacity", "0.4");
		const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
		stop2.setAttribute("offset", "100%");
		stop2.setAttribute("stop-color", "#a957ff");
		stop2.setAttribute("stop-opacity", "0");
		gradient.appendChild(stop1);
		gradient.appendChild(stop2);
		defs.appendChild(gradient);
		svg.appendChild(defs);

		// Create area path (fill under the line)
		if (points.length > 0) {
			const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
			const areaD = `M ${points[0]} L ${points.join(' L ')} L ${width},${height} L 0,${height} Z`;
			areaPath.setAttribute("d", areaD);
			areaPath.setAttribute("class", "bcs-sparkline-area");
			areaPath.setAttribute("fill", `url(#${gradient.id})`);
			svg.appendChild(areaPath);

			// Create line path
			const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
			linePath.setAttribute("d", `M ${points.join(' L ')}`);
			linePath.setAttribute("class", "bcs-sparkline-path");
			svg.appendChild(linePath);
		}

		return svg;
	}

	function formatPublishDate(timePublishedSeconds) {
		if (!timePublishedSeconds) return "";
		try {
			const date = new Date(Number(timePublishedSeconds) * 1000);
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		} catch {
			return "";
		}
	}

	// Create subscriber banner with sparkline
	function createSubscriberBanner() {
		const banner = document.createElement("div");
		banner.className = "bcs-subscriber-banner";

		// Check for hot streak
		if (isSubscriberHotStreak()) {
			banner.classList.add("bcs-hot-streak");
		}

		const label = document.createElement("div");
		label.className = "bcs-subscriber-label";
		label.textContent = "Live Subscribers";

		const valueContainer = document.createElement("div");
		valueContainer.className = "bcs-subscriber-value-container";

		const value = document.createElement("div");
		value.className = "bcs-subscriber-value";
		value.textContent = new Intl.NumberFormat().format(bcsSubscriberCount || 0);

		// Add sparkline if we have history data
		if (bcsSubscriberHistory && bcsSubscriberHistory.length > 0) {
			const sparklineContainer = document.createElement("div");
			sparklineContainer.className = "bcs-subscriber-sparkline";
			const sparklineData = bcsSubscriberHistory.map(item => item.count);
			const sparklineSVG = createSubscriberSparkline(sparklineData);
			sparklineContainer.appendChild(sparklineSVG);
			valueContainer.appendChild(sparklineContainer);
		}

		valueContainer.appendChild(value);
		banner.appendChild(label);
		banner.appendChild(valueContainer);

		return banner;
	}

	// Create watch time banner with its own classes
	function createWatchTimeBanner() {
		const banner = document.createElement("div");
		banner.className = "bcs-watchtime-banner";

		const label = document.createElement("div");
		label.className = "bcs-watchtime-label";
		label.textContent = "30 Day Watch Time";

		const valueContainer = document.createElement("div");
		valueContainer.className = "bcs-watchtime-value-container";

		const value = document.createElement("div");
		value.className = "bcs-watchtime-value";
		value.textContent = formatWatchTimeDaysHoursMinutesSeconds(bcsTotalWatchTime);

		const formatLabel = document.createElement("small");
		formatLabel.className = "bcs-watchtime-format-label";
		formatLabel.textContent = "days:hours:minutes:seconds";

		valueContainer.appendChild(value);
		valueContainer.appendChild(formatLabel);
		banner.appendChild(label);
		banner.appendChild(valueContainer);

		return banner;
	}

	// Calculate total likes from all videos
	function getTotalLikes() {
		let total = 0;
		bcsJoinVideoIdMap.forEach((entry) => {
			total += entry.likeCount || 0;
		});
		return total;
	}

	// Calculate total comments from all videos
	function getTotalComments() {
		let total = 0;
		bcsJoinVideoIdMap.forEach((entry) => {
			total += entry.commentCount || 0;
		});
		return total;
	}

	// Create likes banner
	function createLikesBanner() {
		const banner = document.createElement("div");
		banner.className = "bcs-likes-banner";

		const label = document.createElement("div");
		label.className = "bcs-likes-label";
		label.textContent = "Total Likes";

		const valueContainer = document.createElement("div");
		valueContainer.className = "bcs-likes-value-container";

		const value = document.createElement("div");
		value.className = "bcs-likes-value";
		value.textContent = new Intl.NumberFormat().format(getTotalLikes());

		valueContainer.appendChild(value);
		banner.appendChild(label);
		banner.appendChild(valueContainer);

		return banner;
	}

	// Create comments banner
	function createCommentsBanner() {
		const banner = document.createElement("div");
		banner.className = "bcs-comments-banner";

		const label = document.createElement("div");
		label.className = "bcs-comments-label";
		label.textContent = "Total Comments";

		const valueContainer = document.createElement("div");
		valueContainer.className = "bcs-comments-value-container";

		const value = document.createElement("div");
		value.className = "bcs-comments-value";
		value.textContent = new Intl.NumberFormat().format(getTotalComments());

		valueContainer.appendChild(value);
		banner.appendChild(label);
		banner.appendChild(valueContainer);

		return banner;
	}

	function createRevenueBanner() {
		const banner = document.createElement("div");
		banner.className = "bcs-revenue-banner";

		const label = document.createElement("div");
		label.className = "bcs-revenue-label";
		label.textContent = "Total Estimated Revenue";

		const valueContainer = document.createElement("div");
		valueContainer.className = "bcs-revenue-value-container";

		const value = document.createElement("div");
		value.className = "bcs-revenue-value";

		// Calculate total revenue from all videos
		let totalRevenue = 0;
		bcsVideoEarnings.forEach(earnings => {
			totalRevenue += earnings || 0;
		});

		value.textContent = formatCurrency(totalRevenue);

		valueContainer.appendChild(value);
		banner.appendChild(label);
		banner.appendChild(valueContainer);

		return banner;
	}

	function getTotalRevenue() {
		let total = 0;
		bcsVideoEarnings.forEach(earnings => {
			total += earnings || 0;
		});
		return total;
	}

	// Create sparkline for subscriber data
	function createSubscriberSparkline(data) {
		if (!data || data.length === 0) {
			return document.createElementNS("http://www.w3.org/2000/svg", "svg");
		}

		const width = 200;
		const height = 40;
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", width);
		svg.setAttribute("height", height);
		svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

		// Normalize data for display
		const min = Math.min(...data);
		const max = Math.max(...data, 1);
		const range = max - min || 1;

		const points = data.map((count, i) => {
			const x = (i / (data.length - 1 || 1)) * width;
			const y = height - ((count - min) / range) * height * 0.8 - height * 0.1;
			return `${x},${y}`;
		});

		// Create gradient
		const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
		const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
		gradient.setAttribute("id", `bcs-subscriber-gradient-${Date.now()}`);
		gradient.setAttribute("x1", "0%");
		gradient.setAttribute("y1", "0%");
		gradient.setAttribute("x2", "0%");
		gradient.setAttribute("y2", "100%");
		const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
		stop1.setAttribute("offset", "0%");
		stop1.setAttribute("stop-color", "#a957ff");
		stop1.setAttribute("stop-opacity", "0.4");
		const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
		stop2.setAttribute("offset", "100%");
		stop2.setAttribute("stop-color", "#a957ff");
		stop2.setAttribute("stop-opacity", "0");
		gradient.appendChild(stop1);
		gradient.appendChild(stop2);
		defs.appendChild(gradient);
		svg.appendChild(defs);

		// Create area path
		if (points.length > 0) {
			const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
			const areaD = `M ${points[0]} L ${points.join(' L ')} L ${width},${height} L 0,${height} Z`;
			areaPath.setAttribute("d", areaD);
			areaPath.setAttribute("class", "bcs-subscriber-sparkline-area");
			areaPath.setAttribute("fill", `url(#${gradient.id})`);
			svg.appendChild(areaPath);

			// Create line path
			const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
			linePath.setAttribute("d", `M ${points.join(' L ')}`);
			linePath.setAttribute("class", "bcs-subscriber-sparkline-path");
			svg.appendChild(linePath);
		}

		return svg;
	}

	function buildVideoDataFromCache() {
		const videoDataArray = [];

		bcsJoinVideoIdMap.forEach((entry, videoId) => {
			const views48h = getViews48h(videoId);
			const views60m = getViews60m(videoId);
			const sparkline48h = getSparklineData48h(videoId);
			const sparkline60m = getSparklineData60m(videoId);
			const earnings = bcsVideoEarnings.get(videoId) || null;
			const subscriberNetChange = bcsVideoSubscriberNetChange.get(videoId) || null;
			const watchTime = bcsVideoWatchTime.get(videoId) || null;
			const ctr = bcsVideoCTR.get(videoId) || null;

			videoDataArray.push({
				videoId,
				title: entry.title,
				thumbnailUrl: entry.thumbnailUrl,
				publishDate: formatPublishDate(entry.timePublishedSeconds),
				views48h,
				views60m,
				sparkline48h: sparkline48h || null,
				sparkline60m: sparkline60m || null,
				likeCount: entry.likeCount || 0,
				commentCount: entry.commentCount || 0,
				dislikeCount: entry.dislikeCount || 0,
				viewCount: entry.viewCount || 0,
				earnings: earnings,
				subscriberNetChange: subscriberNetChange,
				watchTime: watchTime,
				ctr: ctr,
			});
		});

		return videoDataArray;
	}

	// Show warming up spinner
	function showWarmingUpSpinner() {
		if (bcsWarmingUpSpinner && document.body.contains(bcsWarmingUpSpinner)) {
			bcsWarmingUpSpinner.classList.remove("bcs-spinner-hidden");
			return;
		}

		// Remove existing if any
		const existing = document.getElementById("bcs-warming-up-spinner");
		if (existing) existing.remove();

		bcsWarmingUpSpinner = document.createElement("div");
		bcsWarmingUpSpinner.id = "bcs-warming-up-spinner";

		const container = document.createElement("div");
		container.className = "bcs-spinner-container";

		const spinner = document.createElement("div");
		spinner.className = "bcs-spinner";

		const text = document.createElement("div");
		text.className = "bcs-warming-text";
		text.textContent = "WARMING UP";

		container.appendChild(spinner);
		container.appendChild(text);
		bcsWarmingUpSpinner.appendChild(container);
		document.body.appendChild(bcsWarmingUpSpinner);
	}

	// Hide warming up spinner
	function hideWarmingUpSpinner() {
		if (bcsWarmingUpSpinner) {
			bcsWarmingUpSpinner.classList.add("bcs-spinner-hidden");
			// Remove from DOM after fade out
			setTimeout(() => {
				if (bcsWarmingUpSpinner && bcsWarmingUpSpinner.parentElement) {
					bcsWarmingUpSpinner.remove();
					bcsWarmingUpSpinner = null;
				}
			}, 500);
		}
	}

	// Build settings panel
	function buildSettingsPanel() {
		if (bcsSettingsPanel) return bcsSettingsPanel;

		const panel = document.createElement("div");
		panel.id = "bcs-settings-panel";
		panel.className = "bcs-settings-panel";

		// Header
		const header = document.createElement("div");
		header.className = "bcs-settings-header";
		const title = document.createElement("h2");
		title.textContent = "Settings";
		title.className = "bcs-settings-title";
		const closeBtn = document.createElement("button");
		closeBtn.className = "bcs-settings-close";
		closeBtn.innerHTML = "✕";
		closeBtn.addEventListener("click", () => toggleSettingsPanel());
		header.appendChild(title);
		header.appendChild(closeBtn);
		panel.appendChild(header);

		// Content
		const content = document.createElement("div");
		content.className = "bcs-settings-content";

		// Badge visibility section
		const badgeSection = createSettingsSection("Badge Visibility", "badges");
		badgeSection.appendChild(createToggle("likes", "Show Likes Badge", "badges", () => applyBadgeSettings()));
		badgeSection.appendChild(createToggle("comments", "Show Comments Badge", "badges", () => applyBadgeSettings()));
		badgeSection.appendChild(createToggle("dislikes", "Show Dislikes Badge", "badges", () => applyBadgeSettings()));
		content.appendChild(badgeSection);

		// Panel visibility section
		const panelSection = createSettingsSection("Top Panel Visibility", "panels");
		panelSection.appendChild(createToggle("subscribers", "Show Subscribers Panel", "panels", () => applyPanelSettings()));
		panelSection.appendChild(createToggle("watchtime", "Show Watchtime Panel", "panels", () => applyPanelSettings()));
		panelSection.appendChild(createToggle("likes", "Show Likes Panel", "panels", () => applyPanelSettings()));
		panelSection.appendChild(createToggle("comments", "Show Comments Panel", "panels", () => applyPanelSettings()));
		panelSection.appendChild(createToggle("revenue", "Show Revenue Panel", "panels", () => applyPanelSettings()));
		content.appendChild(panelSection);

		// Hidden elements section
		const hiddenSection = createSettingsSection("Hidden Elements", "hiddenElements");
		hiddenSection.appendChild(createToggle("channelDashboardIdeasCard", "Channel Dashboard Ideas Card", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("channelDashboardCreatorInsiderCard", "Creator Insider Card", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("channelDashboardProductUpdatesCard", "Product Updates Card", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("channelDashboardCreatorRecognitionCard", "Creator Recognition Card", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("channelDashboardShoppingCard", "Shopping Card", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("channelDashboardNewsCard", "News Card", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("channelDashboardRecentVideosCard", "Recent Videos Card", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("podcastListTab", "Podcast List Tab", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("artistReleasesTab", "Artist Releases Tab", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("videoListCollabsTab", "Video List Collabs Tab", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("seeExploreSubscribersButton", "See Explore Subscribers Button", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("realtimeChart", "Realtime Chart", "hiddenElements", () => applyHiddenElementsSettings()));
		hiddenSection.appendChild(createToggle("latestActivityCardMainChart", "Latest Activity Card Main Chart", "hiddenElements", () => applyHiddenElementsSettings()));
		content.appendChild(hiddenSection);

		// Electron backend section
		const electronSection = createSettingsSection("Electron Backend", "electronBackend");
		electronSection.appendChild(createToggle("enabled", "Enable Electron Backend", "electronBackend", () => {
			applyElectronBackendSettings();
			if (bcsSettings.electronBackend.enabled) {
				initElectronBackendConnection();
			} else {
				// Disconnect if disabled
				if (bcsElectronHeartbeatInterval) {
					clearInterval(bcsElectronHeartbeatInterval);
					bcsElectronHeartbeatInterval = null;
				}
				updateElectronConnectionStatusUI();
			}
		}));
		const urlInput = document.createElement("div");
		urlInput.className = "bcs-settings-input-group";
		const urlLabel = document.createElement("label");
		urlLabel.textContent = "Backend URL:";
		urlLabel.className = "bcs-settings-label";
		const urlField = document.createElement("input");
		urlField.type = "text";
		urlField.className = "bcs-settings-input";
		urlField.value = bcsSettings.electronBackend.url;
		urlField.addEventListener("change", (e) => {
			bcsSettings.electronBackend.url = e.target.value;
			saveSettings();
			applyElectronBackendSettings();
		});
		urlInput.appendChild(urlLabel);
		urlInput.appendChild(urlField);
		electronSection.appendChild(urlInput);
		content.appendChild(electronSection);

		// Hot streak section
		const hotStreakSection = createSettingsSection("Hot Streak Detection", "hotStreak");
		const increasesInput = document.createElement("div");
		increasesInput.className = "bcs-settings-input-group";
		const increasesLabel = document.createElement("label");
		increasesLabel.textContent = "Number of Increases:";
		increasesLabel.className = "bcs-settings-label";
		const increasesField = document.createElement("input");
		increasesField.type = "number";
		increasesField.className = "bcs-settings-input";
		increasesField.min = "1";
		increasesField.value = bcsSettings.hotStreak.increases;
		increasesField.addEventListener("change", (e) => {
			bcsSettings.hotStreak.increases = parseInt(e.target.value) || 5;
			saveSettings();
		});
		increasesInput.appendChild(increasesLabel);
		increasesInput.appendChild(increasesField);
		hotStreakSection.appendChild(increasesInput);

		const timeWindowInput = document.createElement("div");
		timeWindowInput.className = "bcs-settings-input-group";
		const timeWindowLabel = document.createElement("label");
		timeWindowLabel.textContent = "Time Window (minutes):";
		timeWindowLabel.className = "bcs-settings-label";
		const timeWindowField = document.createElement("input");
		timeWindowField.type = "number";
		timeWindowField.className = "bcs-settings-input";
		timeWindowField.min = "1";
		timeWindowField.value = bcsSettings.hotStreak.timeWindowMinutes;
		timeWindowField.addEventListener("change", (e) => {
			bcsSettings.hotStreak.timeWindowMinutes = parseInt(e.target.value) || 5;
			saveSettings();
		});
		timeWindowInput.appendChild(timeWindowLabel);
		timeWindowInput.appendChild(timeWindowField);
		hotStreakSection.appendChild(timeWindowInput);
		content.appendChild(hotStreakSection);

		panel.appendChild(content);
		document.body.appendChild(panel);
		bcsSettingsPanel = panel;
		return panel;
	}

	function createSettingsSection(title, key) {
		const section = document.createElement("div");
		section.className = "bcs-settings-section";
		const sectionTitle = document.createElement("h3");
		sectionTitle.textContent = title;
		sectionTitle.className = "bcs-settings-section-title";
		section.appendChild(sectionTitle);
		return section;
	}

	function createToggle(key, label, category, onChange) {
		const toggle = document.createElement("div");
		toggle.className = "bcs-settings-toggle";
		const labelEl = document.createElement("label");
		labelEl.className = "bcs-settings-toggle-label";
		labelEl.textContent = label;
		const input = document.createElement("input");
		input.type = "checkbox";
		input.className = "bcs-settings-toggle-input";
		input.checked = bcsSettings[category][key];
		input.addEventListener("change", (e) => {
			bcsSettings[category][key] = e.target.checked;
			saveSettings();
			if (onChange) onChange();
		});
		labelEl.appendChild(input);
		toggle.appendChild(labelEl);
		return toggle;
	}

	function toggleSettingsPanel() {
		if (!bcsSettingsPanel) {
			buildSettingsPanel();
		}
		bcsSettingsPanelOpen = !bcsSettingsPanelOpen;
		if (bcsSettingsPanelOpen) {
			bcsSettingsPanel.classList.add("bcs-settings-panel-open");
		} else {
			bcsSettingsPanel.classList.remove("bcs-settings-panel-open");
		}
	}

	// Apply badge visibility settings
	function applyBadgeSettings() {
		if (!bcsCustomTableContainer) return;
		const badges = bcsCustomTableContainer.querySelectorAll(".bcs-badge-likes, .bcs-badge-comments, .bcs-badge-dislikes");
		badges.forEach(badge => {
			if (badge.classList.contains("bcs-badge-likes")) {
				badge.style.display = bcsSettings.badges.likes ? "" : "none";
			} else if (badge.classList.contains("bcs-badge-comments")) {
				badge.style.display = bcsSettings.badges.comments ? "" : "none";
			} else if (badge.classList.contains("bcs-badge-dislikes")) {
				badge.style.display = bcsSettings.badges.dislikes ? "" : "none";
			}
		});
	}

	// Apply panel visibility settings
	function applyPanelSettings() {
		if (!bcsCustomTableContainer) return;
		const banners = bcsCustomTableContainer.querySelectorAll(".bcs-subscriber-banner, .bcs-watchtime-banner, .bcs-likes-banner, .bcs-comments-banner, .bcs-revenue-banner");
		banners.forEach(banner => {
			if (banner.classList.contains("bcs-subscriber-banner")) {
				banner.style.display = bcsSettings.panels.subscribers ? "" : "none";
			} else if (banner.classList.contains("bcs-watchtime-banner")) {
				banner.style.display = bcsSettings.panels.watchtime ? "" : "none";
			} else if (banner.classList.contains("bcs-likes-banner")) {
				banner.style.display = bcsSettings.panels.likes ? "" : "none";
			} else if (banner.classList.contains("bcs-comments-banner")) {
				banner.style.display = bcsSettings.panels.comments ? "" : "none";
			} else if (banner.classList.contains("bcs-revenue-banner")) {
				banner.style.display = bcsSettings.panels.revenue ? "" : "none";
			}
		});
	}

	// Apply hidden elements settings
	function applyHiddenElementsSettings() {
		// Update CSS dynamically based on settings
		let styleId = "bcs-hidden-elements-style";
		let style = document.getElementById(styleId);
		if (!style) {
			style = document.createElement("style");
			style.id = styleId;
			document.head.appendChild(style);
		}

		let css = "";
		if (bcsSettings.hiddenElements.channelDashboardIdeasCard) {
			css += 'ytcd-card[test-id="channel-dashboard-ideas-card"] { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.channelDashboardCreatorInsiderCard) {
			css += 'ytcd-card[test-id="channel-dashboard-creator-insider-card"] { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.channelDashboardProductUpdatesCard) {
			css += 'ytcd-card[test-id="channel-dashboard-product-updates-card"] { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.channelDashboardCreatorRecognitionCard) {
			css += 'ytcd-card[test-id="channel-dashboard-creator-recognition-card"] { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.channelDashboardShoppingCard) {
			css += 'ytcd-card[test-id="channel-dashboard-shopping-card"] { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.channelDashboardNewsCard) {
			css += 'ytcd-card[test-id="channel-dashboard-news-card"] { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.channelDashboardRecentVideosCard) {
			css += 'ytcd-card[test-id="channel-dashboard-recent-videos-card"] { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.podcastListTab) {
			css += '#podcast-list-tab { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.artistReleasesTab) {
			css += '#artist-releases-tab { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.videoListCollabsTab) {
			css += '#video-list-collabs-tab { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.seeExploreSubscribersButton) {
			css += 'ytcp-button#see-explore-subscribers-button { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.realtimeChart) {
			css += 'yta-line-chart-base.yta-realtime-chart { display: none !important; }\n';
		}
		if (bcsSettings.hiddenElements.latestActivityCardMainChart) {
			css += 'yta-latest-activity-card[mini] #main-chart.yta-latest-activity-card { display: none !important; }\n';
		}

		style.textContent = css;
	}

	// Apply Electron backend settings
	function applyElectronBackendSettings() {
		bcsElectronBackendEnabled = bcsSettings.electronBackend.enabled;
		bcsElectronBackendUrl = bcsSettings.electronBackend.url;

		// Update UI to show/hide electron button
		if (bcsCustomTableContainer) {
			const electronBtn = bcsCustomTableContainer.querySelector(".bcs-electron-btn");
			if (electronBtn) {
				electronBtn.style.display = bcsSettings.electronBackend.enabled ? "" : "none";
			}
		}
	}

	// Build custom table
	function buildCustomTable() {
		if (!isAnalyticsPage()) return;

		// Show warming up spinner
		showWarmingUpSpinner();

		// Hide original table
		const originalTable = document.querySelector("#table.style-scope.yta-explore-latest-activity");
		if (originalTable) {
			originalTable.style.display = "none";
		}

		// Build data from our cache
		const videoDataArray = buildVideoDataFromCache();

		if (videoDataArray.length === 0) {
			// No data yet, wait for it
			return;
		}

		// Find container (parent of original table)
		const container = originalTable?.parentElement || document.querySelector("yta-explore-latest-activity");
		if (!container) return;

		// Remove existing custom table if present
		if (bcsCustomTableContainer) {
			bcsCustomTableContainer.remove();
		}

		// Create new table
		bcsCustomTableContainer = document.createElement("div");
		bcsCustomTableContainer.id = "bcs-custom-analytics-table";

		// Build control buttons (connection status, fullscreen, settings, close)
		const controlsContainer = document.createElement("div");
		controlsContainer.className = "bcs-panel-controls";

		// Electron connection status button placeholder (always first)
		const electronBtn = document.createElement("button");
		electronBtn.className = "bcs-control-btn bcs-electron-btn";
		electronBtn.setAttribute("aria-label", "Electron Backend");
		electronBtn.title = "Electron Backend (Disabled)";
		electronBtn.innerHTML = "○";
		electronBtn.style.display = bcsSettings.electronBackend.enabled ? "" : "none";
		controlsContainer.appendChild(electronBtn);

		// Fullscreen button
		const fullscreenBtn = document.createElement("button");
		fullscreenBtn.className = "bcs-control-btn";
		fullscreenBtn.innerHTML = "⛶";
		fullscreenBtn.title = "Fullscreen";
		fullscreenBtn.setAttribute("aria-label", "Fullscreen");
		fullscreenBtn.addEventListener("click", () => {
			if (bcsCustomTableContainer.requestFullscreen) {
				bcsCustomTableContainer.requestFullscreen();
			} else if (bcsCustomTableContainer.webkitRequestFullscreen) {
				bcsCustomTableContainer.webkitRequestFullscreen();
			} else if (bcsCustomTableContainer.mozRequestFullScreen) {
				bcsCustomTableContainer.mozRequestFullScreen();
			} else if (bcsCustomTableContainer.msRequestFullscreen) {
				bcsCustomTableContainer.msRequestFullscreen();
			}
		});

		// Inline settings button (next to close)
		const inlineSettingsBtn = document.createElement("button");
		inlineSettingsBtn.className = "bcs-control-btn bcs-inline-settings-btn";
		inlineSettingsBtn.innerHTML = "⚙";
		inlineSettingsBtn.title = "Settings";
		inlineSettingsBtn.setAttribute("aria-label", "Settings");
		inlineSettingsBtn.addEventListener("click", (e) => {
			e.preventDefault();
			toggleSettingsPanel();
		});

		// Close button (always last)
		const closeBtn = document.createElement("button");
		closeBtn.className = "bcs-control-btn";
		closeBtn.innerHTML = "✕";
		closeBtn.title = "Close";
		closeBtn.setAttribute("aria-label", "Close");
		closeBtn.addEventListener("click", () => {
			//get current URL and remove the /explore and everything after it
			const currentUrl = window.location.href;

			const newUrl = currentUrl.substring(0, currentUrl.indexOf("/explore"));
			// this will remove the /explore and everything after it
			window.location.href = newUrl;
		});

		controlsContainer.appendChild(fullscreenBtn);
		controlsContainer.appendChild(inlineSettingsBtn);
		controlsContainer.appendChild(closeBtn);
		bcsCustomTableContainer.appendChild(controlsContainer);

		// Build banners container
		const bannersContainer = document.createElement("div");
		bannersContainer.className = "bcs-banners-container";

		// Build subscriber count banner (first)
		if (bcsSubscriberCount !== null) {
			const subscriberBanner = createSubscriberBanner();
			bannersContainer.appendChild(subscriberBanner);
		}

		// Build watch time banner (second)
		if (bcsTotalWatchTime > 0) {
			const watchTimeBanner = createWatchTimeBanner();
			bannersContainer.appendChild(watchTimeBanner);
		}

		// Build likes banner (third)
		const likesBanner = createLikesBanner();
		bannersContainer.appendChild(likesBanner);

		// Build comments banner (fourth)
		const commentsBanner = createCommentsBanner();
		bannersContainer.appendChild(commentsBanner);

		// Build revenue banner (fifth)
		const revenueBanner = createRevenueBanner();
		bannersContainer.appendChild(revenueBanner);

		// Only append banners container if it has children
		if (bannersContainer.children.length > 0) {
			bcsCustomTableContainer.appendChild(bannersContainer);
		}

		// Build header
		const header = document.createElement("div");
		header.className = "bcs-table-header";
		header.innerHTML = `
			<div class="bcs-table-header-cell">Content</div>
			<div class="bcs-table-header-cell" style="text-align:left"></div>
			<div class="bcs-table-header-cell" style="text-align:right">Last 48 hours</div>
			<div class="bcs-table-header-cell" style="text-align:right">Last 60 minutes</div>
		`;

		// Build body
		const body = document.createElement("div");
		body.className = "bcs-table-body";

		// Sort by 48h views (descending)
		const sortedData = videoDataArray.sort((a, b) => b.views48h - a.views48h);

		if (sortedData.length === 0) {
			body.innerHTML = '<div class="bcs-empty-state">No data available</div>';
		} else {
			sortedData.forEach((data, index) => {
				const row = createTableRow(data, index);
				body.appendChild(row);
			});
		}

		bcsCustomTableContainer.appendChild(header);
		bcsCustomTableContainer.appendChild(body);

		// Insert before original table or at end of container
		if (originalTable && originalTable.parentElement) {
			originalTable.parentElement.insertBefore(bcsCustomTableContainer, originalTable);
		} else {
			container.appendChild(bcsCustomTableContainer);
		}

		// Apply settings to the newly built table
		applyBadgeSettings();
		applyPanelSettings();
		applyElectronBackendSettings();

		// Store current data for comparison
		bcsCustomTableData = sortedData.map(d => d.videoId);

		// Hide warming up spinner after table is inserted
		requestAnimationFrame(() => {
			hideWarmingUpSpinner();
			updateElectronConnectionStatusUI();
			// Also try to initialize connection if enabled
			if (bcsElectronBackendEnabled) {
				initElectronBackendConnection();
			}
		});
	}

	function createTableRow(data, index) {
		const row = document.createElement("div");
		row.className = "bcs-table-row";
		row.dataset.videoId = data.videoId;
		row.style.transitionDelay = `${index * 20}ms`;

		// Content cell
		const contentCell = document.createElement("div");
		contentCell.className = "bcs-content-cell";

		const thumbnail = document.createElement("img");
		thumbnail.className = "bcs-thumbnail";
		thumbnail.src = data.thumbnailUrl || "";
		thumbnail.alt = data.title;
		if (data.thumbnailUrl) {
			thumbnail.setAttribute("data-thumbnail-url", data.thumbnailUrl);
			thumbnail.style.setProperty("--bcs-thumbnail-tooltip-url", `url(${data.thumbnailUrl})`);
		}

		const contentInfo = document.createElement("div");
		contentInfo.className = "bcs-content-info";

		const title = document.createElement("div");
		title.className = "bcs-video-title";
		title.textContent = data.title;

		const metrics = document.createElement("div");
		metrics.className = "bcs-video-metrics";

		const viewBadge = document.createElement("span");
		viewBadge.className = "bcs-metric-badge";
		viewBadge.textContent = `👁 ${formatNumber(data.viewCount || 0)}`;
		viewBadge.title = "Total Views";
		metrics.appendChild(viewBadge);

		const likeBadge = document.createElement("span");
		likeBadge.className = "bcs-metric-badge bcs-badge-likes";
		likeBadge.textContent = `✅ ${formatNumber(data.likeCount || 0)}`;
		likeBadge.title = "Likes";
		if (isHotStreak(data.videoId, "likes")) {
			likeBadge.classList.add("bcs-hot-streak");
		}
		if (!bcsSettings.badges.likes) {
			likeBadge.style.display = "none";
		}
		metrics.appendChild(likeBadge);

		const dislikeBadge = document.createElement("span");
		dislikeBadge.className = "bcs-metric-badge bcs-badge-dislikes";
		dislikeBadge.textContent = `👎 ${formatNumber(data.dislikeCount || 0)}`;
		dislikeBadge.title = "Dislikes";
		if (isHotStreak(data.videoId, "dislikes")) {
			dislikeBadge.classList.add("bcs-hot-streak");
		}
		if (!bcsSettings.badges.dislikes) {
			dislikeBadge.style.display = "none";
		}
		metrics.appendChild(dislikeBadge);

		const commentBadge = document.createElement("span");
		commentBadge.className = "bcs-metric-badge bcs-badge-comments";
		commentBadge.textContent = `💬 ${formatNumber(data.commentCount || 0)}`;
		commentBadge.title = "Comments";
		if (isHotStreak(data.videoId, "comments")) {
			commentBadge.classList.add("bcs-hot-streak");
		}
		if (!bcsSettings.badges.comments) {
			commentBadge.style.display = "none";
		}
		metrics.appendChild(commentBadge);



		// Add earnings badge if earnings exist
		if (data.earnings !== null && data.earnings !== undefined) {
			const earningsBadge = document.createElement("span");
			earningsBadge.className = "bcs-metric-badge";
			earningsBadge.textContent = `💰 ${formatCurrency(data.earnings)}`;
			earningsBadge.title = "Estimated Earnings";
			metrics.appendChild(earningsBadge);
		}

		// Add subscriber net change badge if exists
		if (data.subscriberNetChange !== null && data.subscriberNetChange !== undefined) {
			const subChangeBadge = document.createElement("span");
			subChangeBadge.className = "bcs-metric-badge";
			const sign = data.subscriberNetChange >= 0 ? "+" : "";
			subChangeBadge.textContent = `👥 ${sign}${formatNumber(data.subscriberNetChange)}`;
			subChangeBadge.title = "Subscriber Net Change";
			metrics.appendChild(subChangeBadge);
		}

		// Add watch time badge if exists
		if (data.watchTime !== null && data.watchTime !== undefined) {
			const watchTimeBadge = document.createElement("span");
			watchTimeBadge.className = "bcs-metric-badge";
			watchTimeBadge.textContent = `⏱ ${formatWatchTime(data.watchTime)}`;
			watchTimeBadge.title = "External Watch Time (Hours)";
			metrics.appendChild(watchTimeBadge);
		}

		// Add CTR badge if exists
		if (data.ctr !== null && data.ctr !== undefined) {
			const ctrBadge = document.createElement("span");
			ctrBadge.className = "bcs-metric-badge";
			ctrBadge.textContent = `📊 ${formatCTR(data.ctr)}`;
			ctrBadge.title = "Click-Through Rate (CTR)";
			metrics.appendChild(ctrBadge);
		}

		contentInfo.appendChild(title);
		contentInfo.appendChild(metrics);
		contentCell.appendChild(thumbnail);
		contentCell.appendChild(contentInfo);

		// Publish date and actions cell (combined)
		const dateActionsCell = document.createElement("div");
		dateActionsCell.className = "bcs-publish-date-cell";

		const dateText = document.createElement("div");
		dateText.className = "bcs-publish-date";
		dateText.textContent = data.publishDate || "";

		const actionsCell = document.createElement("div");
		actionsCell.className = "bcs-actions-cell";

		// Analytics button
		const analyticsBtn = document.createElement("a");
		analyticsBtn.className = "bcs-action-btn";
		analyticsBtn.href = `https://studio.youtube.com/video/${data.videoId}/analytics/tab-overview/period-default`;
		analyticsBtn.target = "_blank";
		analyticsBtn.rel = "noopener noreferrer";
		analyticsBtn.title = "Open Analytics";
		analyticsBtn.innerHTML = "📊";
		analyticsBtn.setAttribute("aria-label", "Open Analytics");

		// View video button
		const viewBtn = document.createElement("a");
		viewBtn.className = "bcs-action-btn";
		viewBtn.href = `https://youtube.com/watch?v=${data.videoId}`;
		viewBtn.target = "_blank";
		viewBtn.rel = "noopener noreferrer";
		viewBtn.title = "View Video";
		viewBtn.innerHTML = "▶️";
		viewBtn.setAttribute("aria-label", "View Video");

		// Edit button
		const editBtn = document.createElement("a");
		editBtn.className = "bcs-action-btn";
		editBtn.href = `https://studio.youtube.com/video/${data.videoId}/edit`;
		editBtn.target = "_blank";
		editBtn.rel = "noopener noreferrer";
		editBtn.title = "Edit Video";
		editBtn.innerHTML = "✏️";
		editBtn.setAttribute("aria-label", "Edit Video");

		// Comments button
		const commentsBtn = document.createElement("a");
		commentsBtn.className = "bcs-action-btn";
		commentsBtn.href = `https://studio.youtube.com/video/${data.videoId}/comments/inbox?filter=%5B%7B%22isDisabled%22%3Afalse%2C%22isPinned%22%3Atrue%2C%22name%22%3A%22SORT_BY%22%2C%22value%22%3A%22SORT_BY_NEWEST%22%7D%5D`;
		commentsBtn.target = "_blank";
		commentsBtn.rel = "noopener noreferrer";
		commentsBtn.title = "View Comments";
		commentsBtn.innerHTML = "💬";
		commentsBtn.setAttribute("aria-label", "View Comments");

		actionsCell.appendChild(analyticsBtn);
		actionsCell.appendChild(viewBtn);
		actionsCell.appendChild(editBtn);
		actionsCell.appendChild(commentsBtn);

		dateActionsCell.appendChild(dateText);
		dateActionsCell.appendChild(actionsCell);

		// 48h metric cell
		const metric48hCell = document.createElement("div");
		metric48hCell.className = "bcs-metric-cell bcs-metric-cell-48h";
		metric48hCell.dataset.metric = "48h";
		const value48h = document.createElement("div");
		value48h.className = "bcs-metric-value";
		value48h.textContent = formatNumber(data.views48h || 0);
		const sparkline48h = document.createElement("div");
		sparkline48h.className = "bcs-sparkline";
		if (data.sparkline48h && data.sparkline48h.length > 0) {
			const shouldGlow48h = isHotStreak(data.videoId, "views48h");
			if (shouldGlow48h) {
				sparkline48h.classList.add("bcs-sparkline-glow");
			}
			sparkline48h.appendChild(createSparklineSVG(data.sparkline48h));
		}
		metric48hCell.appendChild(value48h);
		metric48hCell.appendChild(sparkline48h);

		// 60m metric cell
		const metric60mCell = document.createElement("div");
		metric60mCell.className = "bcs-metric-cell bcs-metric-cell-60m";
		metric60mCell.dataset.metric = "60m";
		const value60m = document.createElement("div");
		value60m.className = "bcs-metric-value";
		value60m.textContent = formatNumber(data.views60m || 0);
		const sparkline60m = document.createElement("div");
		sparkline60m.className = "bcs-sparkline";
		if (data.sparkline60m && data.sparkline60m.length > 0) {
			const shouldGlow60m = isHotStreak(data.videoId, "views60m");
			if (shouldGlow60m) {
				sparkline60m.classList.add("bcs-sparkline-glow");
			}
			sparkline60m.appendChild(createSparklineSVG(data.sparkline60m));
		}
		metric60mCell.appendChild(value60m);
		metric60mCell.appendChild(sparkline60m);

		row.appendChild(contentCell);
		row.appendChild(dateActionsCell);
		row.appendChild(metric48hCell);
		row.appendChild(metric60mCell);

		// Store initial metrics for change detection
		if (!bcsPreviousMetrics.has(data.videoId)) {
			bcsPreviousMetrics.set(data.videoId, {
				likeCount: data.likeCount,
				commentCount: data.commentCount,
				dislikeCount: data.dislikeCount,
			});
		}

		return row;
	}

	// Update custom table with smooth reordering
	function updateCustomTable() {
		if (!isAnalyticsPage()) {
			return;
		}

		if (!bcsCustomTableContainer) {
			buildCustomTable();
			return;
		}

		// Get or create banners container
		let bannersContainer = bcsCustomTableContainer.querySelector(".bcs-banners-container");
		if (!bannersContainer) {
			bannersContainer = document.createElement("div");
			bannersContainer.className = "bcs-banners-container";
			bcsCustomTableContainer.insertBefore(bannersContainer, bcsCustomTableContainer.firstChild);
		}

		// Update subscriber banner if count changed
		const subscriberBanner = bannersContainer.querySelector(".bcs-subscriber-banner");
		if (bcsSubscriberCount !== null) {
			if (!subscriberBanner) {
				// Create banner if it doesn't exist
				const newBanner = createSubscriberBanner();
				bannersContainer.appendChild(newBanner);
			} else {
				// Update existing banner
				const valueEl = subscriberBanner.querySelector(".bcs-subscriber-value");
				const sparklineContainer = subscriberBanner.querySelector(".bcs-subscriber-sparkline");

				// Check if count changed
				const countChanged = bcsPreviousSubscriberCount !== null &&
					bcsSubscriberCount !== bcsPreviousSubscriberCount;

				// Check for hot streak and update class
				const onHotStreak = isSubscriberHotStreak();
				if (onHotStreak) {
					subscriberBanner.classList.add("bcs-hot-streak");
				} else {
					subscriberBanner.classList.remove("bcs-hot-streak");
				}

				if (valueEl) {
					const oldValue = valueEl.textContent;
					const newValue = new Intl.NumberFormat().format(bcsSubscriberCount || 0);
					if (oldValue !== newValue) {
						valueEl.textContent = newValue;
						if (countChanged) {
							// Trigger animation
							valueEl.classList.add("bcs-value-updated");
							subscriberBanner.classList.add("bcs-banner-updated");
							setTimeout(() => {
								valueEl.classList.remove("bcs-value-updated");
								subscriberBanner.classList.remove("bcs-banner-updated");
							}, 800);
						}
					}
				}

				// Update sparkline if history data changed
				if (sparklineContainer && bcsSubscriberHistory && bcsSubscriberHistory.length > 0) {
					const sparklineData = bcsSubscriberHistory.map(item => item.count);
					sparklineContainer.innerHTML = "";
					const sparklineSVG = createSubscriberSparkline(sparklineData);
					sparklineContainer.appendChild(sparklineSVG);
				} else if (!sparklineContainer && bcsSubscriberHistory && bcsSubscriberHistory.length > 0) {
					// Add sparkline if it doesn't exist but we have data
					const valueContainer = subscriberBanner.querySelector(".bcs-subscriber-value-container");
					if (valueContainer) {
						const newSparkline = document.createElement("div");
						newSparkline.className = "bcs-subscriber-sparkline";
						const sparklineData = bcsSubscriberHistory.map(item => item.count);
						const sparklineSVG = createSubscriberSparkline(sparklineData);
						newSparkline.appendChild(sparklineSVG);
						valueContainer.insertBefore(newSparkline, valueContainer.firstChild);
					}
				}
			}
		}

		// Update watch time banner if count changed
		const watchTimeBanner = bannersContainer.querySelector(".bcs-watchtime-banner");
		if (bcsTotalWatchTime > 0) {
			if (!watchTimeBanner) {
				// Create banner if it doesn't exist
				const newBanner = createWatchTimeBanner();
				bannersContainer.appendChild(newBanner);
			} else {
				// Update existing banner
				const valueEl = watchTimeBanner.querySelector(".bcs-watchtime-value");
				if (valueEl) {
					valueEl.textContent = formatWatchTimeDaysHoursMinutesSeconds(bcsTotalWatchTime);
				}
			}
		}

		// Update likes banner
		const likesBanner = bannersContainer.querySelector(".bcs-likes-banner");
		if (!likesBanner) {
			// Create banner if it doesn't exist
			const newBanner = createLikesBanner();
			bannersContainer.appendChild(newBanner);
		} else {
			// Update existing banner
			const valueEl = likesBanner.querySelector(".bcs-likes-value");
			if (valueEl) {
				valueEl.textContent = new Intl.NumberFormat().format(getTotalLikes());
			}
		}

		// Update comments banner
		const commentsBanner = bannersContainer.querySelector(".bcs-comments-banner");
		if (!commentsBanner) {
			// Create banner if it doesn't exist
			const newBanner = createCommentsBanner();
			bannersContainer.appendChild(newBanner);
		} else {
			// Update existing banner
			const valueEl = commentsBanner.querySelector(".bcs-comments-value");
			if (valueEl) {
				valueEl.textContent = new Intl.NumberFormat().format(getTotalComments());
			}
		}

		// Update revenue banner
		const revenueBanner = bannersContainer.querySelector(".bcs-revenue-banner");
		if (!revenueBanner) {
			// Create banner if it doesn't exist
			const newBanner = createRevenueBanner();
			bannersContainer.appendChild(newBanner);
		} else {
			// Update existing banner
			const valueEl = revenueBanner.querySelector(".bcs-revenue-value");
			if (valueEl) {
				valueEl.textContent = formatCurrency(getTotalRevenue());
			}
		}

		// Build fresh data from cache
		const videoDataArray = buildVideoDataFromCache();

		if (videoDataArray.length === 0) {
			return;
		}

		// Sort by 60m views (descending)
		const sortedData = videoDataArray.sort((a, b) => b.views60m - a.views60m);
		const newOrder = sortedData.map(d => d.videoId);

		// Create a hash of the data to detect actual changes (include both 48h and 60m)
		const dataHash = sortedData.map(d => `${d.videoId}:${d.views48h}:${d.views60m}`).join('|');

		// Check if order changed
		const orderChanged = JSON.stringify(newOrder) !== JSON.stringify(bcsCustomTableData);

		// Always update sparklines and values (they can change independently)
		// Only skip full update if hash matches and order hasn't changed
		if (dataHash === bcsLastUpdateHash && !orderChanged) {
			// Hash matches and order hasn't changed, but still update sparklines and values
			// since they can change independently
			updateTableValues(sortedData, false); // false = update everything including values
			return;
		}
		bcsLastUpdateHash = dataHash;

		if (!orderChanged && sortedData.length === bcsCustomTableData.length) {
			// Just update values, no reordering needed
			updateTableValues(sortedData);
		} else {
			// Reorder with animation
			reorderTableWithAnimation(sortedData);
		}

		bcsCustomTableData = newOrder;
	}

	function updateTableValues(data, sparklinesOnly = false) {
		const body = bcsCustomTableContainer.querySelector(".bcs-table-body");
		if (!body) return;

		data.forEach((videoData) => {
			const row = body.querySelector(`[data-video-id="${videoData.videoId}"]`);
			if (!row) return;

			// Get previous metrics
			const previous = bcsPreviousMetrics.get(videoData.videoId) || {};
			const prevLikes = previous.likeCount ?? null;
			const prevComments = previous.commentCount ?? null;
			const prevDislikes = previous.dislikeCount ?? null;

			// Check for changes
			const likesChanged = prevLikes !== null && videoData.likeCount > prevLikes;
			const commentsChanged = prevComments !== null && videoData.commentCount > prevComments;
			const dislikesChanged = prevDislikes !== null && videoData.dislikeCount > prevDislikes;
			const hasMetricChange = likesChanged || commentsChanged || dislikesChanged;

			// Update values
			const value48h = row.querySelector('.bcs-metric-cell[data-metric="48h"] .bcs-metric-value');
			const value60m = row.querySelector('.bcs-metric-cell[data-metric="60m"] .bcs-metric-value');
			const sparkline48h = row.querySelector('.bcs-metric-cell[data-metric="48h"] .bcs-sparkline');
			const sparkline60m = row.querySelector('.bcs-metric-cell[data-metric="60m"] .bcs-sparkline');
			const metrics = row.querySelector(".bcs-video-metrics");

			// Always update 48h and 60m values and sparklines (they can change independently)
			if (value48h) value48h.textContent = formatNumber(videoData.views48h || 0);
			if (value60m) value60m.textContent = formatNumber(videoData.views60m || 0);

			// Check for view count increases for sparkline glow
			const prevViews48h = previous.views48h ?? null;
			const prevViews60m = previous.views60m ?? null;
			const views48hIncreased = prevViews48h !== null && videoData.views48h > prevViews48h;
			const views60mIncreased = prevViews60m !== null && videoData.views60m > prevViews60m;

			// Track view count increases for glow effect
			if (views48hIncreased) {
				trackMetricChange(videoData.videoId, "views48h", videoData.views48h);
			}
			if (views60mIncreased) {
				trackMetricChange(videoData.videoId, "views60m", videoData.views60m);
			}

			// Check if sparkline should glow (increases within 5 minutes)
			const shouldGlow48h = isHotStreak(videoData.videoId, "views48h");
			const shouldGlow60m = isHotStreak(videoData.videoId, "views60m");

			// Skip metric updates if only updating sparklines
			if (!sparklinesOnly) {
				// Track metric changes for hot streak detection
				if (likesChanged && videoData.likeCount > prevLikes) {
					trackMetricChange(videoData.videoId, "likes", videoData.likeCount);
				}
				if (commentsChanged && videoData.commentCount > prevComments) {
					trackMetricChange(videoData.videoId, "comments", videoData.commentCount);
				}
				if (dislikesChanged && videoData.dislikeCount > prevDislikes) {
					trackMetricChange(videoData.videoId, "dislikes", videoData.dislikeCount);
				}

				// Update metrics with individual badges for glow effect
				// Only recreate badges if they don't exist or if metrics changed
				if (metrics) {
					const existingBadges = metrics.querySelectorAll(".bcs-metric-badge");
					const needsRecreate = existingBadges.length === 0 || hasMetricChange;

					if (needsRecreate) {
						// Recreate all badges (only when needed)
						const viewBadge = document.createElement("span");
						viewBadge.className = "bcs-metric-badge";
						viewBadge.textContent = `👁 ${formatNumber(videoData.viewCount || 0)}`;
						viewBadge.title = "Total Views";

						const likeBadge = document.createElement("span");
						likeBadge.className = "bcs-metric-badge bcs-badge-likes";
						likeBadge.textContent = `✅ ${formatNumber(videoData.likeCount || 0)}`;
						likeBadge.title = "Likes";
						if (likesChanged) {
							likeBadge.classList.add("bcs-badge-glow");
						}
						if (isHotStreak(videoData.videoId, "likes")) {
							likeBadge.classList.add("bcs-hot-streak");
						} else {
							likeBadge.classList.remove("bcs-hot-streak");
						}
						if (!bcsSettings.badges.likes) {
							likeBadge.style.display = "none";
						}

						const commentBadge = document.createElement("span");
						commentBadge.className = "bcs-metric-badge bcs-badge-comments";
						commentBadge.textContent = `💬 ${formatNumber(videoData.commentCount || 0)}`;
						commentBadge.title = "Comments";
						if (commentsChanged) {
							commentBadge.classList.add("bcs-badge-glow");
						}
						if (isHotStreak(videoData.videoId, "comments")) {
							commentBadge.classList.add("bcs-hot-streak");
						} else {
							commentBadge.classList.remove("bcs-hot-streak");
						}
						if (!bcsSettings.badges.comments) {
							commentBadge.style.display = "none";
						}

						const dislikeBadge = document.createElement("span");
						dislikeBadge.className = "bcs-metric-badge bcs-badge-dislikes";
						dislikeBadge.textContent = `👎 ${formatNumber(videoData.dislikeCount || 0)}`;
						dislikeBadge.title = "Dislikes";
						if (dislikesChanged) {
							dislikeBadge.classList.add("bcs-badge-glow");
						}
						if (isHotStreak(videoData.videoId, "dislikes")) {
							dislikeBadge.classList.add("bcs-hot-streak");
						} else {
							dislikeBadge.classList.remove("bcs-hot-streak");
						}
						if (!bcsSettings.badges.dislikes) {
							dislikeBadge.style.display = "none";
						}

						metrics.innerHTML = "";
						metrics.appendChild(viewBadge);
						metrics.appendChild(likeBadge);
						metrics.appendChild(commentBadge);
						metrics.appendChild(dislikeBadge);

						// Add earnings badge if earnings exist
						if (videoData.earnings !== null && videoData.earnings !== undefined) {
							const earningsBadge = document.createElement("span");
							earningsBadge.className = "bcs-metric-badge";
							earningsBadge.textContent = `💰 ${formatCurrency(videoData.earnings)}`;
							earningsBadge.title = "Estimated Earnings";
							metrics.appendChild(earningsBadge);
						}

						// Add subscriber net change badge if exists
						if (videoData.subscriberNetChange !== null && videoData.subscriberNetChange !== undefined) {
							const subChangeBadge = document.createElement("span");
							subChangeBadge.className = "bcs-metric-badge";
							const sign = videoData.subscriberNetChange >= 0 ? "+" : "";
							subChangeBadge.textContent = `👥 ${sign}${formatNumber(videoData.subscriberNetChange)}`;
							subChangeBadge.title = "Subscriber Net Change";
							metrics.appendChild(subChangeBadge);
						}

						// Add watch time badge if exists
						if (videoData.watchTime !== null && videoData.watchTime !== undefined) {
							const watchTimeBadge = document.createElement("span");
							watchTimeBadge.className = "bcs-metric-badge";
							watchTimeBadge.textContent = `⏱ ${formatWatchTime(videoData.watchTime)}`;
							watchTimeBadge.title = "External Watch Time (Hours)";
							metrics.appendChild(watchTimeBadge);
						}

						// Add CTR badge if exists
						if (videoData.ctr !== null && videoData.ctr !== undefined) {
							const ctrBadge = document.createElement("span");
							ctrBadge.className = "bcs-metric-badge";
							ctrBadge.textContent = `📊 ${formatCTR(videoData.ctr)}`;
							ctrBadge.title = "Click-Through Rate (CTR)";
							metrics.appendChild(ctrBadge);
						}

						// Remove glow class after animation
						if (likesChanged || commentsChanged || dislikesChanged) {
							setTimeout(() => {
								if (likeBadge.parentElement) likeBadge.classList.remove("bcs-badge-glow");
								if (commentBadge.parentElement) commentBadge.classList.remove("bcs-badge-glow");
								if (dislikeBadge.parentElement) dislikeBadge.classList.remove("bcs-badge-glow");
							}, 1200);
						}
					} else {
						// Just update existing badges' content and classes without recreating
						// Find existing badges and update them individually
						const allBadges = metrics.querySelectorAll(".bcs-metric-badge");
						allBadges.forEach(badge => {
							// Update view badge (first badge without a specific class)
							if (!badge.classList.contains("bcs-badge-likes") &&
								!badge.classList.contains("bcs-badge-comments") &&
								!badge.classList.contains("bcs-badge-dislikes") &&
								badge.textContent.startsWith("👁")) {
								const newText = `👁 ${formatNumber(videoData.viewCount || 0)}`;
								if (badge.textContent !== newText) {
									badge.textContent = newText;
								}
							}
						});

						const likeBadge = metrics.querySelector(".bcs-badge-likes");
						const commentBadge = metrics.querySelector(".bcs-badge-comments");
						const dislikeBadge = metrics.querySelector(".bcs-badge-dislikes");

						if (likeBadge) {
							const newText = `✅ ${formatNumber(videoData.likeCount || 0)}`;
							if (likeBadge.textContent !== newText) {
								likeBadge.textContent = newText;
							}
							// Update hot streak class
							if (isHotStreak(videoData.videoId, "likes")) {
								likeBadge.classList.add("bcs-hot-streak");
							} else {
								likeBadge.classList.remove("bcs-hot-streak");
							}
							// Update visibility based on settings
							likeBadge.style.display = bcsSettings.badges.likes ? "" : "none";
						}

						if (commentBadge) {
							const newText = `💬 ${formatNumber(videoData.commentCount || 0)}`;
							if (commentBadge.textContent !== newText) {
								commentBadge.textContent = newText;
							}
							// Update hot streak class
							if (isHotStreak(videoData.videoId, "comments")) {
								commentBadge.classList.add("bcs-hot-streak");
							} else {
								commentBadge.classList.remove("bcs-hot-streak");
							}
							// Update visibility based on settings
							commentBadge.style.display = bcsSettings.badges.comments ? "" : "none";
						}

						if (dislikeBadge) {
							const newText = `👎 ${formatNumber(videoData.dislikeCount || 0)}`;
							if (dislikeBadge.textContent !== newText) {
								dislikeBadge.textContent = newText;
							}
							// Update hot streak class
							if (isHotStreak(videoData.videoId, "dislikes")) {
								dislikeBadge.classList.add("bcs-hot-streak");
							} else {
								dislikeBadge.classList.remove("bcs-hot-streak");
							}
							// Update visibility based on settings
							dislikeBadge.style.display = bcsSettings.badges.dislikes ? "" : "none";
						}
					}
				}
			}

			// Update sparklines - always update them
			if (sparkline48h) {
				sparkline48h.innerHTML = "";
				if (videoData.sparkline48h && videoData.sparkline48h.length > 0) {
					const svg = createSparklineSVG(videoData.sparkline48h);
					if (shouldGlow48h) {
						sparkline48h.classList.add("bcs-sparkline-glow");
					} else {
						sparkline48h.classList.remove("bcs-sparkline-glow");
					}
					sparkline48h.appendChild(svg);
				}
			}
			if (sparkline60m) {
				sparkline60m.innerHTML = "";
				if (videoData.sparkline60m && videoData.sparkline60m.length > 0) {
					const svg = createSparklineSVG(videoData.sparkline60m);
					if (shouldGlow60m) {
						sparkline60m.classList.add("bcs-sparkline-glow");
					} else {
						sparkline60m.classList.remove("bcs-sparkline-glow");
					}
					sparkline60m.appendChild(svg);
				}
			}

			// Only pulse row if metrics changed (and not in sparklines-only mode)
			if (!sparklinesOnly && hasMetricChange) {
				row.classList.add("bcs-row-updating");
				setTimeout(() => row.classList.remove("bcs-row-updating"), 600);
			}

			// Store current metrics for next comparison (always store view counts)
			const currentMetrics = bcsPreviousMetrics.get(videoData.videoId) || {};
			bcsPreviousMetrics.set(videoData.videoId, {
				...currentMetrics,
				likeCount: videoData.likeCount,
				commentCount: videoData.commentCount,
				dislikeCount: videoData.dislikeCount,
				views48h: videoData.views48h,
				views60m: videoData.views60m,
			});
		});
	}

	function reorderTableWithAnimation(newData) {
		const body = bcsCustomTableContainer.querySelector(".bcs-table-body");
		if (!body) return;

		// Create a map of existing rows
		const existingRows = new Map();
		Array.from(body.children).forEach(row => {
			const videoId = row.dataset.videoId;
			if (videoId) existingRows.set(videoId, row);
		});

		// Clear body
		body.innerHTML = "";

		// Add rows in new order with animation
		newData.forEach((videoData, index) => {
			let row = existingRows.get(videoData.videoId);
			if (!row) {
				// Create new row
				row = createTableRow(videoData, index);
				row.classList.add("bcs-row-new");
			} else {
				// Update existing row
				updateRowContent(row, videoData);
			}
			row.style.transitionDelay = `${index * 15}ms`;
			body.appendChild(row);
		});

		// Remove new class after animation
		setTimeout(() => {
			body.querySelectorAll(".bcs-row-new").forEach(row => {
				row.classList.remove("bcs-row-new");
			});
		}, 500);
	}

	function updateRowContent(row, data) {
		// Update all content in the row
		const title = row.querySelector(".bcs-video-title");
		const thumbnail = row.querySelector(".bcs-thumbnail");
		const publishDate = row.querySelector(".bcs-publish-date");
		const metrics = row.querySelector(".bcs-video-metrics");
		const value48h = row.querySelector('.bcs-metric-cell[data-metric="48h"] .bcs-metric-value');
		const value60m = row.querySelector('.bcs-metric-cell[data-metric="60m"] .bcs-metric-value');
		const sparkline48h = row.querySelector('.bcs-metric-cell[data-metric="48h"] .bcs-sparkline');
		const sparkline60m = row.querySelector('.bcs-metric-cell[data-metric="60m"] .bcs-sparkline');

		// Get previous metrics
		const previous = bcsPreviousMetrics.get(data.videoId) || {};
		const prevLikes = previous.likeCount ?? null;
		const prevComments = previous.commentCount ?? null;
		const prevDislikes = previous.dislikeCount ?? null;

		// Check for changes
		const likesChanged = prevLikes !== null && data.likeCount > prevLikes;
		const commentsChanged = prevComments !== null && data.commentCount > prevComments;
		const dislikesChanged = prevDislikes !== null && data.dislikeCount > prevDislikes;
		const hasMetricChange = likesChanged || commentsChanged || dislikesChanged;

		// Track metric changes for hot streak detection
		if (likesChanged && data.likeCount > prevLikes) {
			trackMetricChange(data.videoId, "likes", data.likeCount);
		}
		if (commentsChanged && data.commentCount > prevComments) {
			trackMetricChange(data.videoId, "comments", data.commentCount);
		}
		if (dislikesChanged && data.dislikeCount > prevDislikes) {
			trackMetricChange(data.videoId, "dislikes", data.dislikeCount);
		}

		if (title) title.textContent = data.title;
		if (thumbnail) {
			thumbnail.src = data.thumbnailUrl || "";
			if (data.thumbnailUrl) {
				thumbnail.setAttribute("data-thumbnail-url", data.thumbnailUrl);
				thumbnail.style.setProperty("--bcs-thumbnail-tooltip-url", `url(${data.thumbnailUrl})`);
			} else {
				thumbnail.removeAttribute("data-thumbnail-url");
				thumbnail.style.removeProperty("--bcs-thumbnail-tooltip-url");
			}
		}
		if (publishDate) publishDate.textContent = data.publishDate || "";

		// Update metrics with individual badges for glow effect
		if (metrics) {
			const viewBadge = document.createElement("span");
			viewBadge.className = "bcs-metric-badge";
			viewBadge.textContent = `👁 ${formatNumber(data.viewCount || 0)}`;
			viewBadge.title = "Total Views";

			const likeBadge = document.createElement("span");
			likeBadge.className = "bcs-metric-badge bcs-badge-likes";
			likeBadge.textContent = `✅ ${formatNumber(data.likeCount || 0)}`;
			likeBadge.title = "Likes";
			if (likesChanged) {
				likeBadge.classList.add("bcs-badge-glow");
			}
			if (isHotStreak(data.videoId, "likes")) {
				likeBadge.classList.add("bcs-hot-streak");
			} else {
				likeBadge.classList.remove("bcs-hot-streak");
			}
			if (!bcsSettings.badges.likes) {
				likeBadge.style.display = "none";
			}

			const commentBadge = document.createElement("span");
			commentBadge.className = "bcs-metric-badge bcs-badge-comments";
			commentBadge.textContent = `💬 ${formatNumber(data.commentCount || 0)}`;
			commentBadge.title = "Comments";
			if (commentsChanged) {
				commentBadge.classList.add("bcs-badge-glow");
			}
			if (isHotStreak(data.videoId, "comments")) {
				commentBadge.classList.add("bcs-hot-streak");
			} else {
				commentBadge.classList.remove("bcs-hot-streak");
			}
			if (!bcsSettings.badges.comments) {
				commentBadge.style.display = "none";
			}

			const dislikeBadge = document.createElement("span");
			dislikeBadge.className = "bcs-metric-badge bcs-badge-dislikes";
			dislikeBadge.textContent = `👎 ${formatNumber(data.dislikeCount || 0)}`;
			dislikeBadge.title = "Dislikes";
			if (dislikesChanged) {
				dislikeBadge.classList.add("bcs-badge-glow");
			}
			if (isHotStreak(data.videoId, "dislikes")) {
				dislikeBadge.classList.add("bcs-hot-streak");
			} else {
				dislikeBadge.classList.remove("bcs-hot-streak");
			}
			if (!bcsSettings.badges.dislikes) {
				dislikeBadge.style.display = "none";
			}

			metrics.innerHTML = "";
			metrics.appendChild(viewBadge);
			metrics.appendChild(likeBadge);
			metrics.appendChild(commentBadge);
			metrics.appendChild(dislikeBadge);

			// Add earnings badge if earnings exist
			if (data.earnings !== null && data.earnings !== undefined) {
				const earningsBadge = document.createElement("span");
				earningsBadge.className = "bcs-metric-badge";
				earningsBadge.textContent = `💰 ${formatCurrency(data.earnings)}`;
				earningsBadge.title = "Estimated Earnings";
				metrics.appendChild(earningsBadge);
			}

			// Add subscriber net change badge if exists
			if (data.subscriberNetChange !== null && data.subscriberNetChange !== undefined) {
				const subChangeBadge = document.createElement("span");
				subChangeBadge.className = "bcs-metric-badge";
				const sign = data.subscriberNetChange >= 0 ? "+" : "";
				subChangeBadge.textContent = `👥 ${sign}${formatNumber(data.subscriberNetChange)}`;
				subChangeBadge.title = "Subscriber Net Change";
				metrics.appendChild(subChangeBadge);
			}

			// Add watch time badge if exists
			if (data.watchTime !== null && data.watchTime !== undefined) {
				const watchTimeBadge = document.createElement("span");
				watchTimeBadge.className = "bcs-metric-badge";
				watchTimeBadge.textContent = `⏱ ${formatWatchTime(data.watchTime)}`;
				watchTimeBadge.title = "External Watch Time (Hours)";
				metrics.appendChild(watchTimeBadge);
			}

			// Add CTR badge if exists
			if (data.ctr !== null && data.ctr !== undefined) {
				const ctrBadge = document.createElement("span");
				ctrBadge.className = "bcs-metric-badge";
				ctrBadge.textContent = `📊 ${formatCTR(data.ctr)}`;
				ctrBadge.title = "Click-Through Rate (CTR)";
				metrics.appendChild(ctrBadge);
			}

			// Remove glow class after animation
			if (likesChanged || commentsChanged || dislikesChanged) {
				setTimeout(() => {
					if (likeBadge.parentElement) likeBadge.classList.remove("bcs-badge-glow");
					if (commentBadge.parentElement) commentBadge.classList.remove("bcs-badge-glow");
					if (dislikeBadge.parentElement) dislikeBadge.classList.remove("bcs-badge-glow");
				}, 1200);
			}
		}

		if (value48h) value48h.textContent = formatNumber(data.views48h || 0);
		if (value60m) value60m.textContent = formatNumber(data.views60m || 0);

		// Check for sparkline glow
		const shouldGlow48h = isHotStreak(data.videoId, "views48h");
		const shouldGlow60m = isHotStreak(data.videoId, "views60m");

		if (sparkline48h) {
			sparkline48h.innerHTML = "";
			if (data.sparkline48h && data.sparkline48h.length > 0) {
				if (shouldGlow48h) {
					sparkline48h.classList.add("bcs-sparkline-glow");
				} else {
					sparkline48h.classList.remove("bcs-sparkline-glow");
				}
				sparkline48h.appendChild(createSparklineSVG(data.sparkline48h));
			}
		}
		if (sparkline60m) {
			sparkline60m.innerHTML = "";
			if (data.sparkline60m && data.sparkline60m.length > 0) {
				if (shouldGlow60m) {
					sparkline60m.classList.add("bcs-sparkline-glow");
				} else {
					sparkline60m.classList.remove("bcs-sparkline-glow");
				}
				sparkline60m.appendChild(createSparklineSVG(data.sparkline60m));
			}
		}

		// Only pulse row if metrics changed
		if (hasMetricChange) {
			row.classList.add("bcs-row-updating");
			setTimeout(() => row.classList.remove("bcs-row-updating"), 600);
		}

		// Store current metrics for next comparison
		bcsPreviousMetrics.set(data.videoId, {
			likeCount: data.likeCount,
			commentCount: data.commentCount,
			dislikeCount: data.dislikeCount,
		});
	}

	// Electron backend functions
	function loadElectronBackendSettings() {
		if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
			chrome.storage.local.get(["bcsElectronBackendEnabled", "bcsElectronBackendUrl"], (result) => {
				if (result.bcsElectronBackendEnabled !== undefined) {
					bcsElectronBackendEnabled = result.bcsElectronBackendEnabled;
				}
				if (result.bcsElectronBackendUrl) {
					bcsElectronBackendUrl = result.bcsElectronBackendUrl;
				}
				if (bcsElectronBackendEnabled && isAnalyticsPage()) {
					initElectronBackendConnection();
				}
			});
		} else {
			console.log("[BCS Electron] Chrome storage not available");
		}
	}

	function saveElectronBackendSettings() {
		console.log("[BCS Electron] Saving settings - enabled:", bcsElectronBackendEnabled, "url:", bcsElectronBackendUrl);
		if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
			chrome.storage.local.set({
				bcsElectronBackendEnabled: bcsElectronBackendEnabled,
				bcsElectronBackendUrl: bcsElectronBackendUrl
			}, () => {
				console.log("[BCS Electron] Settings saved successfully");
			});
		} else {
			console.log("[BCS Electron] Chrome storage not available for saving");
		}
	}

	function initElectronBackendConnection() {
		// Use settings instead of old variable
		if (!bcsSettings.electronBackend.enabled) {
			return;
		}
		if (bcsElectronConnectionId) {
			return; // Already connected
		}

		// Generate unique connection ID
		bcsElectronConnectionId = `bcs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		console.log("[BCS Electron] Initializing connection with ID:", bcsElectronConnectionId, "to", bcsSettings.electronBackend.url);

		// Establish connection
		sendElectronHeartbeat();

		// Start heartbeat interval (30 seconds)
		if (bcsElectronHeartbeatInterval) {
			clearInterval(bcsElectronHeartbeatInterval);
		}
		bcsElectronHeartbeatInterval = setInterval(() => {
			sendElectronHeartbeat();
		}, 30000);

		// Update connection status UI
		updateElectronConnectionStatusUI();
	}

	function disconnectElectronBackend() {
		if (bcsElectronHeartbeatInterval) {
			clearInterval(bcsElectronHeartbeatInterval);
			bcsElectronHeartbeatInterval = null;
		}
		bcsElectronConnectionId = null;
		updateElectronConnectionStatusUI();
	}

	async function sendElectronHeartbeat() {
		if (!bcsSettings.electronBackend.enabled || !bcsElectronConnectionId) {
			return;
		}

		try {
			const response = await fetch(`${bcsSettings.electronBackend.url}/api/heartbeat`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					connectionId: bcsElectronConnectionId
				})
			});

			if (!response.ok) {
				if (response.status === 409) {
					// Another connection is active
					bcsElectronConnectionId = null;
					updateElectronConnectionStatusUI();
				}
			}
		} catch (error) {
			// Connection failed, but don't disconnect immediately
			console.log("[BCS Electron] Heartbeat error:", error);
		}
	}

	async function sendElectronData(data, notifications) {
		if (!bcsSettings.electronBackend.enabled || !bcsElectronConnectionId) return;

		try {
			const response = await fetch(`${bcsSettings.electronBackend.url}/api/data`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					connectionId: bcsElectronConnectionId,
					data: data,
					notifications: notifications || []
				})
			});

			if (!response.ok) {
				if (response.status === 409) {
					// Another connection is active
					bcsElectronConnectionId = null;
					updateElectronConnectionStatusUI();
				} else if (response.status === 401) {
					// No active connection, try to reconnect
					initElectronBackendConnection();
				}
			}
		} catch (error) {
			console.log("Error sending data to Electron backend:", error);
		}
	}

	function buildElectronDataPayload() {
		const videoDataArray = buildVideoDataFromCache();
		const totalLikes = getTotalLikes();
		const totalComments = getTotalComments();

		// Collect notifications from toast queue
		const notifications = [];
		bcsToastQueue.forEach(toast => {
			if (toast.videoId && toast.title) {
				notifications.push({
					videoId: toast.videoId,
					title: toast.title,
					thumbnailUrl: toast.thumbnailUrl || null,
					type: toast.type || 'likes',
					newCount: toast.newCount || 0,
					oldCount: toast.oldCount || 0
				});
			}
		});

		return {
			timestamp: Date.now(),
			subscriberCount: bcsSubscriberCount,
			subscriberHistory: bcsSubscriberHistory,
			totalWatchTime: bcsTotalWatchTime,
			totalLikes: totalLikes,
			totalComments: totalComments,
			videos: videoDataArray
		};
	}

	function updateElectronConnectionStatusUI() {
		if (!isAnalyticsPage()) {
			return;
		}

		// Wait for table container if it doesn't exist yet
		if (!bcsCustomTableContainer) {
			// Try again after a short delay
			setTimeout(updateElectronConnectionStatusUI, 500);
			return;
		}

		// Find or create electron backend button (should already exist as first control)
		const controls = bcsCustomTableContainer.querySelector(".bcs-panel-controls");
		if (!controls) {
			return;
		}

		let electronBtn = controls.querySelector(".bcs-electron-btn");
		if (!electronBtn) {
			electronBtn = document.createElement("button");
			electronBtn.className = "bcs-control-btn bcs-electron-btn";
			electronBtn.setAttribute("aria-label", "Electron Backend");
			electronBtn.innerHTML = "○";
			controls.prepend(electronBtn);
		}

		const isConnected = bcsSettings.electronBackend.enabled && bcsElectronConnectionId !== null;

		// Update button appearance based on connection status
		if (isConnected) {
			electronBtn.innerHTML = "●";
			electronBtn.title = "Electron Backend (Connected)";
			electronBtn.style.color = "#4caf50";
		} else if (bcsSettings.electronBackend.enabled) {
			electronBtn.innerHTML = "○";
			electronBtn.title = "Electron Backend (Connecting...)";
			electronBtn.style.color = "#ffa500";
		} else {
			electronBtn.innerHTML = "○";
			electronBtn.title = "Electron Backend (Disabled)";
			electronBtn.style.color = "#f44336";
		}

		// Show/hide based on settings
		electronBtn.style.display = bcsSettings.electronBackend.enabled ? "" : "none";

		electronBtn.onclick = () => {
			// Toggle enabled state
			bcsSettings.electronBackend.enabled = !bcsSettings.electronBackend.enabled;
			saveSettings();
			applyElectronBackendSettings();

			if (bcsSettings.electronBackend.enabled) {
				initElectronBackendConnection();
			} else {
				disconnectElectronBackend();
			}

			updateElectronConnectionStatusUI();
		};

		bcsElectronConnectionStatusElement = electronBtn;
	}

	// Toggle function is now handled via addEventListener in updateElectronConnectionStatusUI
	// Keeping this for backwards compatibility if needed
	window.bcsToggleElectronBackend = function (event) {
		bcsElectronBackendEnabled = event.target.checked;
		saveElectronBackendSettings();

		if (bcsElectronBackendEnabled) {
			initElectronBackendConnection();
		} else {
			disconnectElectronBackend();
		}

		updateElectronConnectionStatusUI();
	};

	// Replace the old analytics sync function
	function scheduleAnalyticsSync() {
		if (!isAnalyticsPage()) return;
		if (bcsAnalyticsSyncScheduled) return;
		bcsAnalyticsSyncScheduled = true;
		requestAnimationFrame(() => {
			bcsAnalyticsSyncScheduled = false;
			try {
				updateCustomTable();

				// Send data to Electron backend if enabled
				if (bcsElectronBackendEnabled) {
					const data = buildElectronDataPayload();
					const notifications = [];
					bcsToastQueue.forEach(toast => {
						if (toast.videoId && toast.title) {
							notifications.push({
								videoId: toast.videoId,
								title: toast.title,
								thumbnailUrl: toast.thumbnailUrl || null,
								type: toast.type || 'likes',
								newCount: toast.newCount || 0,
								oldCount: toast.oldCount || 0
							});
						}
					});
					sendElectronData(data, notifications);
				}
			} catch (error) {
				console.log(error);
			}
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
