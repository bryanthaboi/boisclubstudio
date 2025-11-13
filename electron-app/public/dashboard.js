// Dashboard state
let currentData = null;
let lastNotificationCheck = 0;
let refreshInterval = null;
let previousData = null;
let lastUpdateTime = null;
const shownToasts = new Set(); // Track shown toasts to prevent duplicates
const REFRESH_INTERVAL = 5000; // 5 seconds
const API_BASE = '';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();

    // Set up auto-refresh
    refreshInterval = setInterval(() => {
        loadDashboard();
    }, REFRESH_INTERVAL);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

async function checkConnectionStatus() {
    // Connection status check removed - no longer needed
}

async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        const status = await response.json();

        // Remove loading message
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.remove();
        }

        if (!status.data) {
            showEmptyState('No data available. Make sure the Chrome extension is connected.');
            return;
        }

        // Check for metric changes and show toasts
        // Only detect changes if we have previous data to compare against
        if (previousData && currentData && previousData.videos && currentData.videos) {
            detectMetricChanges(previousData, status.data);
        }

        // Store current data as previous for next comparison
        previousData = currentData ? JSON.parse(JSON.stringify(currentData)) : null;
        currentData = status.data;
        lastUpdateTime = new Date();
        updateLastUpdateTime();

        renderDashboard(status.data);

        // Don't check server notifications if we're already detecting changes locally
        // This prevents duplicate toasts
        // checkNotifications(status.notifications || []);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.remove();
        }
        showEmptyState('Error loading data. Please try again.');
    }
}

function updateLastUpdateTime() {
    const updateEl = document.getElementById('last-update');
    if (updateEl && lastUpdateTime) {
        const timeStr = lastUpdateTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        updateEl.textContent = `last update: ${timeStr}`;
    }
}

function renderDashboard(data) {
    const content = document.getElementById('dashboard-content');

    // Update or create subscriber banner - full width one line
    let subscriberBanner = content.querySelector('.subscriber-banner');
    if (data.subscriberCount !== null && data.subscriberCount !== undefined) {
        if (!subscriberBanner) {
            subscriberBanner = document.createElement('div');
            subscriberBanner.className = 'subscriber-banner';
            content.insertBefore(subscriberBanner, content.firstChild);
        }
        // Always update the text
        subscriberBanner.textContent = `SUBS: ${new Intl.NumberFormat().format(data.subscriberCount)}`;
    }

    // Videos list
    if (data.videos && data.videos.length > 0) {
        let videosContainer = content.querySelector('.videos-container');
        if (!videosContainer) {
            videosContainer = document.createElement('div');
            videosContainer.className = 'videos-container';
            content.appendChild(videosContainer);
        }

        let videoList = videosContainer.querySelector('.video-list');
        if (!videoList) {
            videoList = document.createElement('div');
            videoList.className = 'video-list';
            videosContainer.appendChild(videoList);
        }

        // Sort by 60m views
        const sortedVideos = [...data.videos].sort((a, b) => (b.views60m || 0) - (a.views60m || 0));

        // Get existing cards in order
        const existingCards = Array.from(videoList.querySelectorAll('.video-card'));
        const existingCardMap = new Map();
        existingCards.forEach(card => {
            existingCardMap.set(card.dataset.videoId, card);
        });

        // Remove all cards first, we'll re-add them in order
        existingCards.forEach(card => card.remove());

        // Add cards in sorted order
        sortedVideos.forEach((video) => {
            const existingCard = existingCardMap.get(video.videoId);
            if (existingCard) {
                // Update existing card
                updateVideoCard(existingCard, video);
                videoList.appendChild(existingCard);
            } else {
                // Create new card
                videoList.appendChild(createVideoCard(video));
            }
        });
    } else {
        const existingEmpty = content.querySelector('.empty-state');
        if (!existingEmpty) {
            content.appendChild(createEmptyState('No video data available'));
        }
    }
}

function updateVideoCard(card, video) {
    // Update thumbnail only if URL changed
    if (video.thumbnailUrl) {
        const thumbnail = card.querySelector('.video-thumbnail');
        if (thumbnail) {
            if (thumbnail.dataset.src !== video.thumbnailUrl) {
                thumbnail.dataset.src = video.thumbnailUrl;
                thumbnail.src = video.thumbnailUrl;
            }
        } else {
            // Create thumbnail if it doesn't exist
            const header = card.querySelector('.video-header');
            if (header) {
                const newThumbnail = document.createElement('img');
                newThumbnail.className = 'video-thumbnail';
                newThumbnail.src = video.thumbnailUrl;
                newThumbnail.alt = video.title || '';
                newThumbnail.loading = 'lazy';
                newThumbnail.dataset.src = video.thumbnailUrl;
                header.insertBefore(newThumbnail, header.firstChild);
            }
        }
    }

    // Update title
    const titleEl = card.querySelector('.video-title');
    if (titleEl) {
        titleEl.textContent = video.title || 'Untitled';
    }

    // Update metrics - only animate if raw value actually changed
    const metricsEl = card.querySelector('.video-metrics');
    if (metricsEl) {
        // Update existing badges or create new ones
        if (video.viewCount !== undefined) {
            let badge = metricsEl.querySelector('[data-metric-type="views"]');
            if (badge) {
                const oldRawValue = parseFloat(badge.dataset.rawValue || '0');
                const newRawValue = video.viewCount;
                if (oldRawValue !== newRawValue) {
                    badge.dataset.rawValue = newRawValue;
                    updateMetricBadge(badge, formatNumber(newRawValue), '👁');
                }
            } else {
                const badge = createMetricBadge('👁', formatNumber(video.viewCount), 'views', video.videoId);
                badge.dataset.rawValue = video.viewCount;
                metricsEl.appendChild(badge);
            }
        }

        if (video.likeCount !== undefined) {
            let badge = metricsEl.querySelector('[data-metric-type="likes"]');
            if (badge) {
                const oldRawValue = parseFloat(badge.dataset.rawValue || '0');
                const newRawValue = video.likeCount;
                if (oldRawValue !== newRawValue) {
                    badge.dataset.rawValue = newRawValue;
                    updateMetricBadge(badge, formatNumber(newRawValue), '✅');
                }
            } else {
                const badge = createMetricBadge('✅', formatNumber(video.likeCount), 'likes', video.videoId);
                badge.dataset.rawValue = video.likeCount;
                metricsEl.appendChild(badge);
            }
        }

        if (video.commentCount !== undefined) {
            let badge = metricsEl.querySelector('[data-metric-type="comments"]');
            if (badge) {
                const oldRawValue = parseFloat(badge.dataset.rawValue || '0');
                const newRawValue = video.commentCount;
                if (oldRawValue !== newRawValue) {
                    badge.dataset.rawValue = newRawValue;
                    updateMetricBadge(badge, formatNumber(newRawValue), '💬');
                }
            } else {
                const badge = createMetricBadge('💬', formatNumber(video.commentCount), 'comments', video.videoId);
                badge.dataset.rawValue = video.commentCount;
                metricsEl.appendChild(badge);
            }
        }

        if (video.earnings !== null && video.earnings !== undefined) {
            let badge = metricsEl.querySelector('[data-metric-type="earnings"]');
            if (badge) {
                const oldRawValue = parseFloat(badge.dataset.rawValue || '0');
                const newRawValue = video.earnings;
                if (oldRawValue !== newRawValue) {
                    badge.dataset.rawValue = newRawValue;
                    badge.textContent = `💰 ${formatCurrency(newRawValue)}`;
                }
            } else {
                const badge = createMetricBadge('💰', formatCurrency(video.earnings), 'earnings', video.videoId);
                badge.dataset.rawValue = video.earnings;
                metricsEl.appendChild(badge);
            }
        }
    }

    // Update sparklines - find the views container
    const info = card.querySelector('.video-info');
    if (info) {
        let viewsContainer = info.querySelector('div[style*="display: flex"]');
        if (!viewsContainer && (video.views48h !== undefined || video.views60m !== undefined)) {
            // Create views container if it doesn't exist
            viewsContainer = document.createElement('div');
            viewsContainer.style.cssText = 'display: flex; gap: 0.75rem; margin-top: 0.375rem; font-size: 0.6875rem;';
            info.appendChild(viewsContainer);
        }

        if (viewsContainer) {
            // Update or create 48h view
            if (video.views48h !== undefined) {
                let view48hItem = Array.from(viewsContainer.children).find(el =>
                    el.textContent.includes('48h:')
                );

                if (!view48hItem) {
                    view48hItem = document.createElement('div');
                    view48hItem.style.cssText = 'display: flex; align-items: center; gap: 0.375rem;';
                    const label = document.createElement('span');
                    label.style.color = 'var(--text-secondary)';
                    label.textContent = '48h:';
                    const value = document.createElement('span');
                    value.style.cssText = 'font-weight: 600; color: var(--text-primary);';
                    value.textContent = formatNumber(video.views48h || 0);
                    view48hItem.appendChild(label);
                    view48hItem.appendChild(value);
                    if (video.sparkline48h && video.sparkline48h.length > 0) {
                        view48hItem.appendChild(createSparklineSVG(video.sparkline48h));
                    }
                    viewsContainer.appendChild(view48hItem);
                } else {
                    const value = view48hItem.querySelector('span[style*="font-weight"]');
                    if (value) {
                        value.textContent = formatNumber(video.views48h || 0);
                    }
                    // Remove ALL SVG elements (sparklines) from this item
                    const allSvgs = view48hItem.querySelectorAll('svg');
                    allSvgs.forEach(svg => svg.remove());

                    // Add new sparkline if data exists
                    if (video.sparkline48h && video.sparkline48h.length > 0) {
                        view48hItem.appendChild(createSparklineSVG(video.sparkline48h));
                    }
                }
            }

            // Update or create 60m view
            if (video.views60m !== undefined) {
                let view60mItem = Array.from(viewsContainer.children).find(el =>
                    el.textContent.includes('60m:')
                );

                if (!view60mItem) {
                    view60mItem = document.createElement('div');
                    view60mItem.style.cssText = 'display: flex; align-items: center; gap: 0.375rem;';
                    const label = document.createElement('span');
                    label.style.color = 'var(--text-secondary)';
                    label.textContent = '60m:';
                    const value = document.createElement('span');
                    value.style.cssText = 'font-weight: 600; color: var(--text-primary);';
                    value.textContent = formatNumber(video.views60m || 0);
                    view60mItem.appendChild(label);
                    view60mItem.appendChild(value);
                    if (video.sparkline60m && video.sparkline60m.length > 0) {
                        view60mItem.appendChild(createSparklineSVG(video.sparkline60m));
                    }
                    viewsContainer.appendChild(view60mItem);
                } else {
                    const value = view60mItem.querySelector('span[style*="font-weight"]');
                    if (value) {
                        value.textContent = formatNumber(video.views60m || 0);
                    }
                    // Remove ALL SVG elements (sparklines) from this item
                    const allSvgs = view60mItem.querySelectorAll('svg');
                    allSvgs.forEach(svg => svg.remove());

                    // Add new sparkline if data exists
                    if (video.sparkline60m && video.sparkline60m.length > 0) {
                        view60mItem.appendChild(createSparklineSVG(video.sparkline60m));
                    }
                }
            }
        }
    }
}

function createBanner(label, value, formatLabel, sparklineData) {
    const banner = document.createElement('div');
    banner.className = 'banner';

    const labelEl = document.createElement('div');
    labelEl.className = 'banner-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = 'banner-value';
    if (value.length > 15) {
        valueEl.className += ' banner-value-small';
    }
    valueEl.textContent = value;

    banner.appendChild(labelEl);
    banner.appendChild(valueEl);

    if (formatLabel) {
        const formatEl = document.createElement('div');
        formatEl.className = 'banner-format-label';
        formatEl.textContent = formatLabel;
        banner.appendChild(formatEl);
    }

    // Removed sparkline from subscriber banner as requested

    return banner;
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.videoId = video.videoId;

    const header = document.createElement('div');
    header.className = 'video-header';

    if (video.thumbnailUrl) {
        // Check if thumbnail already exists to prevent reload
        let thumbnail = card.querySelector('.video-thumbnail');
        if (!thumbnail) {
            thumbnail = document.createElement('img');
            thumbnail.className = 'video-thumbnail';
            thumbnail.src = video.thumbnailUrl;
            thumbnail.alt = video.title || '';
            thumbnail.loading = 'lazy';
            // Only update src if it's different
            thumbnail.dataset.src = video.thumbnailUrl;
            header.appendChild(thumbnail);
        } else {
            // Only update if URL changed
            if (thumbnail.dataset.src !== video.thumbnailUrl) {
                thumbnail.dataset.src = video.thumbnailUrl;
                thumbnail.src = video.thumbnailUrl;
            }
        }
    }

    const info = document.createElement('div');
    info.className = 'video-info';

    const title = document.createElement('div');
    title.className = 'video-title';
    title.textContent = video.title || 'Untitled';
    info.appendChild(title);

    const metrics = document.createElement('div');
    metrics.className = 'video-metrics';

    if (video.viewCount !== undefined) {
        const badge = createMetricBadge('👁', formatNumber(video.viewCount), 'views', video.videoId);
        badge.dataset.rawValue = video.viewCount;
        metrics.appendChild(badge);
    }
    if (video.likeCount !== undefined) {
        const badge = createMetricBadge('✅', formatNumber(video.likeCount), 'likes', video.videoId);
        badge.dataset.rawValue = video.likeCount;
        metrics.appendChild(badge);
    }
    if (video.commentCount !== undefined) {
        const badge = createMetricBadge('💬', formatNumber(video.commentCount), 'comments', video.videoId);
        badge.dataset.rawValue = video.commentCount;
        metrics.appendChild(badge);
    }
    if (video.earnings !== null && video.earnings !== undefined) {
        const badge = createMetricBadge('💰', formatCurrency(video.earnings), 'earnings', video.videoId);
        badge.dataset.rawValue = video.earnings;
        metrics.appendChild(badge);
    }

    info.appendChild(metrics);
    header.appendChild(info);
    card.appendChild(header);

    // Compact sparklines - inline with video info
    const viewsContainer = document.createElement('div');
    viewsContainer.style.cssText = 'display: flex; gap: 0.75rem; margin-top: 0.375rem; font-size: 0.6875rem;';

    if (video.views48h !== undefined || video.sparkline48h) {
        const viewItem = document.createElement('div');
        viewItem.style.cssText = 'display: flex; align-items: center; gap: 0.375rem;';

        const label = document.createElement('span');
        label.style.color = 'var(--text-secondary)';
        label.textContent = '48h:';

        const value = document.createElement('span');
        value.style.cssText = 'font-weight: 600; color: var(--text-primary);';
        value.textContent = formatNumber(video.views48h || 0);

        viewItem.appendChild(label);
        viewItem.appendChild(value);

        if (video.sparkline48h && video.sparkline48h.length > 0) {
            const svg = createSparklineSVG(video.sparkline48h);
            viewItem.appendChild(svg);
        }

        viewsContainer.appendChild(viewItem);
    }

    if (video.views60m !== undefined || video.sparkline60m) {
        const viewItem = document.createElement('div');
        viewItem.style.cssText = 'display: flex; align-items: center; gap: 0.375rem;';

        const label = document.createElement('span');
        label.style.color = 'var(--text-secondary)';
        label.textContent = '60m:';

        const value = document.createElement('span');
        value.style.cssText = 'font-weight: 600; color: var(--text-primary);';
        value.textContent = formatNumber(video.views60m || 0);

        viewItem.appendChild(label);
        viewItem.appendChild(value);

        if (video.sparkline60m && video.sparkline60m.length > 0) {
            const svg = createSparklineSVG(video.sparkline60m);
            viewItem.appendChild(svg);
        }

        viewsContainer.appendChild(viewItem);
    }

    if (viewsContainer.children.length > 0) {
        info.appendChild(viewsContainer);
    }

    return card;
}

function createMetricBadge(icon, value, metricType, videoId) {
    const badge = document.createElement('span');
    badge.className = 'metric-badge';
    badge.dataset.metricType = metricType;
    badge.dataset.videoId = videoId;
    badge.textContent = `${icon} ${value}`;
    return badge;
}

function updateMetricBadge(badge, newValue, icon) {
    const oldValue = badge.textContent;
    badge.textContent = `${icon} ${newValue}`;

    // Add animation class
    badge.classList.add('metric-updated');
    setTimeout(() => {
        badge.classList.remove('metric-updated');
    }, 1000);
}

function detectMetricChanges(oldData, newData) {
    if (!oldData || !newData || !oldData.videos || !newData.videos) return;

    const oldVideos = new Map(oldData.videos.map(v => [v.videoId, v]));

    newData.videos.forEach(newVideo => {
        const oldVideo = oldVideos.get(newVideo.videoId);
        if (!oldVideo) return;

        // Check likes
        if (newVideo.likeCount !== undefined && oldVideo.likeCount !== undefined) {
            if (newVideo.likeCount > oldVideo.likeCount) {
                const increase = newVideo.likeCount - oldVideo.likeCount;
                showToast(newVideo, 'likes', increase, newVideo.likeCount, oldVideo.likeCount);
            }
        }

        // Check comments
        if (newVideo.commentCount !== undefined && oldVideo.commentCount !== undefined) {
            if (newVideo.commentCount > oldVideo.commentCount) {
                const increase = newVideo.commentCount - oldVideo.commentCount;
                showToast(newVideo, 'comments', increase, newVideo.commentCount, oldVideo.commentCount);
            }
        }


    });

    // Check subscribers
    if (newData.subscriberCount !== undefined && oldData.subscriberCount !== undefined) {
        if (newData.subscriberCount > oldData.subscriberCount) {
            const increase = newData.subscriberCount - oldData.subscriberCount;
            showSubscriberToast(increase, newData.subscriberCount, oldData.subscriberCount);
        }
    }
}

function showToast(video, type, increase, newCount, oldCount) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Create unique key based on video, type, and the specific count value
    // This ensures we don't show the same notification twice
    const toastKey = `${video.videoId}-${type}-${newCount}`;

    // Check if we've already shown this exact toast
    if (shownToasts.has(toastKey)) {
        return; // Already shown, skip
    }

    // Also check if there's already a visible toast for this video+type
    const existingToasts = container.querySelectorAll('.toast.toast-show');
    for (const existingToast of existingToasts) {
        const toastTitle = existingToast.querySelector('.toast-title');
        if (toastTitle && toastTitle.textContent === (video.title || 'Untitled')) {
            const toastText = existingToast.querySelector('.toast-text');
            if (toastText) {
                const text = toastText.textContent.toLowerCase();
                if ((type === 'likes' && text.includes('like')) ||
                    (type === 'comments' && text.includes('comment'))) {
                    // Already showing a toast for this video and type
                    return;
                }
            }
        }
    }

    // Mark as shown
    shownToasts.add(toastKey);

    // Clean up old entries after 10 seconds (longer window)
    setTimeout(() => {
        shownToasts.delete(toastKey);
    }, 10000);

    const toast = document.createElement('div');
    toast.className = 'toast';

    const message = type === 'comments'
        ? `${increase} new comment${increase !== 1 ? 's' : ''}`
        : type === 'likes'
            ? `${increase} new like${increase !== 1 ? 's' : ''}`
            : `${increase} new view${increase !== 1 ? 's' : ''}`;

    toast.innerHTML = `
        ${video.thumbnailUrl ? `<img src="${video.thumbnailUrl}" class="toast-thumb" alt="">` : ''}
        <div class="toast-content">
            <div class="toast-text">${message}</div>
            <div class="toast-title">${video.title || 'Untitled'}</div>
        </div>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, 4000);
}

function showSubscriberToast(increase, newCount, oldCount) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Prevent duplicate subscriber toasts
    const toastKey = `subscriber-${newCount}`;
    if (shownToasts.has(toastKey)) {
        return; // Already shown, skip
    }

    // Also check if there's already a visible subscriber toast
    const existingToasts = container.querySelectorAll('.toast.toast-subscriber.toast-show');
    if (existingToasts.length > 0) {
        return; // Already showing a subscriber toast
    }

    shownToasts.add(toastKey);

    // Clean up after 10 seconds (longer window)
    setTimeout(() => {
        shownToasts.delete(toastKey);
    }, 10000);

    const toast = document.createElement('div');
    toast.className = 'toast toast-subscriber';

    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-text">+${increase} subscriber${increase !== 1 ? 's' : ''}</div>
            <div class="toast-title">${formatNumber(newCount)} total</div>
        </div>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, 4000);
}

function createSparkline(data) {
    const container = document.createElement('div');
    container.style.marginTop = '0.5rem';
    container.appendChild(createSparklineSVG(data));
    return container;
}

function createSparklineSVG(data) {
    const width = 80;
    const height = 20;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.className = 'sparkline-svg';

    if (!data || data.length === 0) {
        return svg;
    }

    // Create gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    const gradientId = `sparkline-gradient-${Date.now()}-${Math.random()}`;
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#a957ff');
    stop1.setAttribute('stop-opacity', '0.3');

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#a957ff');
    stop2.setAttribute('stop-opacity', '0');

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    // Normalize data
    const max = Math.max(...data, 1);
    const min = 0;

    const points = data.map((value, i) => {
        const x = (i / (data.length - 1 || 1)) * width;
        const y = height - ((value - min) / (max - min || 1)) * height * 0.8 - height * 0.1;
        return `${x},${y}`;
    });

    if (points.length > 0) {
        // Area path
        const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const areaD = `M ${points[0]} L ${points.join(' L ')} L ${width},${height} L 0,${height} Z`;
        areaPath.setAttribute('d', areaD);
        areaPath.setAttribute('class', 'sparkline-area');
        areaPath.setAttribute('fill', `url(#${gradientId})`);
        svg.appendChild(areaPath);

        // Line path
        const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        linePath.setAttribute('d', `M ${points.join(' L ')}`);
        linePath.setAttribute('class', 'sparkline-path');
        linePath.setAttribute('stroke', '#a957ff');
        linePath.setAttribute('stroke-width', '1.5');
        linePath.setAttribute('fill', 'none');
        svg.appendChild(linePath);
    }

    return svg;
}

function checkNotifications(notifications) {
    if (!notifications || notifications.length === 0) return;

    const newNotifications = notifications.filter(n => {
        // Simple check - in a real app you'd track which ones you've shown
        return true;
    });

    newNotifications.forEach(notification => {
        showBrowserNotification(notification);
    });
}

function showBrowserNotification(notification) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }

    const increase = (notification.newCount || 0) - (notification.oldCount || 0);
    const message = notification.type === 'comments'
        ? `${increase} new comment${increase !== 1 ? 's' : ''} on ${notification.title}`
        : `${increase} new like${increase !== 1 ? 's' : ''} on ${notification.title}`;

    new Notification('BCS Analytics', {
        body: message,
        icon: notification.thumbnailUrl || '/icon-192.png',
        tag: `bcs-${notification.videoId}-${notification.type}-${Date.now()}`
    });
}

function showEmptyState(message) {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = '';
    content.appendChild(createEmptyState(message));
}

function createEmptyState(message) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = message;
    return empty;
}

// Formatting functions
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
    if (!milliseconds || milliseconds === 0) return "0:00:00:00";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

