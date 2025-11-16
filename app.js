const canvas = document.getElementById('homeMenu');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

const resizeCanvas = () => {
    const padding = 100;
    const availableWidth = window.innerWidth - padding;
    const availableHeight = window.innerHeight - padding;
    
    const scaleX = Math.floor(availableWidth / 400);
    const scaleY = Math.floor(availableHeight / 240);
    const scale = Math.max(1, Math.min(scaleX, scaleY));
    
    canvas.style.width = (400 * scale) + 'px';
    canvas.style.height = (240 * scale) + 'px';
};

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const COLORS = {
    bgTop: '#5eb1e8',
    bgBottom: '#1e75b8',
    text: '#ffffff'
};

const BOOK_DIMENSIONS = {
    width: 140,
    height: 200,
    x: 120,
    y: 22,
    spineDepth: 10,
    pagesDepth: 3
};

const STATUS_BAR_CONFIG = {
    height: 20,
    pillY: 2,
    pillHeight: 16
};

const ANIMATION_TIMING = {
    flipSpeed: 1.25,
    volumeFirstDelay: 3.0,
    volumeDisplay: 4.0,
    volumeFade: 0.8,
    statusCycle: 3.0,
    statusFade: 0.6
};

const drawRoundedRect = (ctx, { x, y, width, height, radius = 6, fill, stroke, strokeWidth = 1 }) => {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, Math.max(0, radius - 2));
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
};

const drawGlassPanel = (ctx, { x, y, width, height, radius = 6, fill = 'rgba(255, 255, 255, 0.12)', stroke = 'rgba(255, 255, 255, 0.3)', strokeWidth = 1 }) => {
    drawRoundedRect(ctx, { x, y, width, height, radius, fill, stroke, strokeWidth });
};

const drawText = (ctx, { text, x, y, font, color = COLORS.text, align = 'left', baseline = 'alphabetic' }) => {
    const savedFont = ctx.font;
    const savedFill = ctx.fillStyle;
    const savedAlign = ctx.textAlign;
    const savedBaseline = ctx.textBaseline;
    const savedSmoothing = ctx.imageSmoothingEnabled;
    
    ctx.imageSmoothingEnabled = false;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    
    ctx.fillText(text, Math.round(x), Math.round(y));
    
    ctx.font = savedFont;
    ctx.fillStyle = savedFill;
    ctx.textAlign = savedAlign;
    ctx.textBaseline = savedBaseline;
    ctx.imageSmoothingEnabled = savedSmoothing;
};

let libraryApps = [];
let currentPageIndex = 0;
let totalPageCount = 0;
let loadedImages = {};
let isLoading = true;
let hasError = false;
let errorMessage = '';
let totalPagesRead = 0;
let volumeListScrollPosition = 0;

let pageFlipDirection = 0;
let pageFlipProgress = 0;
let targetPageIndex = -1;

let wobbleAnimationTime = 0;
let currentVolumeIndex = 0;
let nextVolumeIndex = -1;
let volumeCrossfadeProgress = 0;
let volumeDisplayTimer = 0;

let statusBarCycleTimer = 0;
let statusBarFadeProgress = 0;
let internetTextTimer = 0;
let internetTextFadeProgress = 0;
let previousFrameTime = 0;

const floatingBubbles = Array.from({ length: 15 }, () => ({
    x: Math.random() * 400,
    y: Math.random() * 240,
    radius: Math.random() * 30 + 10,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.3,
    opacity: Math.random() * 0.1 + 0.05
}));

const easeInQuad = (t) => t * t;

const easeOutBack = (t) => {
    const springConstant = 1.70158;
    const adjusted = springConstant + 1;
    return 1 + adjusted * Math.pow(t - 1, 3) + springConstant * Math.pow(t - 1, 2);
};

const calculateFadeAlpha = (animationProgress) => {
    if (animationProgress < 0.5) {
        return 1.0 - easeInQuad(animationProgress * 2);
    } else {
        const alpha = easeOutBack((animationProgress - 0.5) * 2);
        return Math.max(0, Math.min(1, alpha));
    }
};

const wrapTextToLines = (ctx, text, maxWidth, maxLines) => {
    const characters = text.split('');
    let currentLine = '';
    const lines = [];
    
    for (let i = 0; i < characters.length; i++) {
        const testLine = currentLine + characters[i];
        if (ctx.measureText(testLine).width > maxWidth && i > 0) {
            lines.push(currentLine);
            currentLine = characters[i];
            if (lines.length >= maxLines) break;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine && lines.length < maxLines) lines.push(currentLine);
    
    if (lines.length === maxLines && characters.length > currentLine.length) {
        lines[maxLines - 1] = lines[maxLines - 1].slice(0, -3) + '...';
    }
    
    return lines;
};

const truncateTextWithEllipsis = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
};

const drawBackground = () => {
    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, 240);
    backgroundGradient.addColorStop(0, COLORS.bgTop);
    backgroundGradient.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, 400, 240);
    
    const edgeShadows = [
        { x: 0, y: 0, w: 400, h: 2, color: 'rgba(255, 255, 255, 0.15)' },
        { x: 0, y: 0, w: 20, h: 240, gradient: [0, 0, 20, 0, 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0)'] },
        { x: 380, y: 0, w: 20, h: 240, gradient: [380, 0, 400, 0, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.3)'] },
        { x: 0, y: 220, w: 400, h: 20, gradient: [0, 220, 0, 240, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.4)'] }
    ];

    edgeShadows.forEach(edge => {
        if (edge.gradient) {
            const edgeGradient = ctx.createLinearGradient(...edge.gradient.slice(0, 4));
            edgeGradient.addColorStop(0, edge.gradient[4]);
            edgeGradient.addColorStop(1, edge.gradient[5]);
            ctx.fillStyle = edgeGradient;
        } else {
            ctx.fillStyle = edge.color;
        }
        ctx.fillRect(edge.x, edge.y, edge.w, edge.h);
    });

    floatingBubbles.forEach(bubble => {
        ctx.globalAlpha = bubble.opacity * 0.6;
        const bubbleShadowGradient = ctx.createRadialGradient(
            bubble.x, bubble.y + bubble.radius * 0.7, 0,
            bubble.x, bubble.y + bubble.radius * 0.7, bubble.radius * 1.4
        );
        bubbleShadowGradient.addColorStop(0, 'rgba(10, 20, 40, 0.25)');
        bubbleShadowGradient.addColorStop(1, 'rgba(10, 20, 40, 0)');
        ctx.fillStyle = bubbleShadowGradient;
        ctx.beginPath();
        ctx.ellipse(
            bubble.x,
            bubble.y + bubble.radius * 0.7,
            bubble.radius * 1.2,
            bubble.radius * 0.4,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.globalAlpha = bubble.opacity;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.fill();

        bubble.x += bubble.speedX;
        bubble.y += bubble.speedY;

        if (bubble.x < -bubble.radius) bubble.x = 400 + bubble.radius;
        if (bubble.x > 400 + bubble.radius) bubble.x = -bubble.radius;
        if (bubble.y < -bubble.radius) bubble.y = 240 + bubble.radius;
        if (bubble.y > 240 + bubble.radius) bubble.y = -bubble.radius;
    });
    ctx.globalAlpha = 1;
};

const drawStatusBarPill = (x, width, color, iconFunction, text, textAlign = 'left') => {
    const { pillY, pillHeight } = STATUS_BAR_CONFIG;
    const iconY = pillY + 4;
    const textY = pillY + 11;

    drawRoundedRect(ctx, {
        x,
        y: pillY,
        width,
        height: pillHeight,
        radius: 6,
        fill: color
    });

    iconFunction(x + 4, iconY);

    const textX = textAlign === 'right' ? x + width - 6 : x + 16;
    drawText(ctx, {
        text,
        x: textX,
        y: textY,
        font: 'bold 9px Verdana, Geneva, sans-serif',
        align: textAlign
    });
};

const drawWiFiIcon = (x, y) => {
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(x, y + 5, 2, 2);
    ctx.fillRect(x + 3, y + 3, 2, 4);
    ctx.fillRect(x + 6, y + 1, 2, 6);
};

const drawBookIcon = (x, y) => {
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(x, y + 1, 7, 6);
    ctx.fillRect(x + 2, y, 3, 1);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 3.5, y + 2);
    ctx.lineTo(x + 3.5, y + 7);
    ctx.stroke();
};

const drawVolumesIcon = (x, y) => {
    ctx.fillStyle = COLORS.text;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    [[x + 2, y], [x + 1, y + 1], [x, y + 2]].forEach(position => {
        ctx.fillRect(position[0], position[1], 6, 5);
        ctx.strokeRect(position[0], position[1], 6, 5);
    });
};

const drawPageIcon = (x, y) => {
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(x, y + 1, 6, 7);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 1);
    ctx.lineTo(x + 6, y + 1);
    ctx.lineTo(x + 6, y + 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    [[y + 4], [y + 6]].forEach(yPosition => {
        ctx.beginPath();
        ctx.moveTo(x + 1, yPosition);
        ctx.lineTo(x + 5, yPosition);
        ctx.stroke();
    });
};

const drawCalendarIcon = (x, y) => {
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(x, y + 3, 7, 5);
    ctx.fillRect(x, y + 1, 7, 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + 1, y + 1, 1, 2);
    ctx.fillRect(x + 5, y + 1, 1, 2);
};

const drawClockIcon = (x, y) => {
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + 3.5, y + 3.5, 3.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 3.5, y + 3.5);
    ctx.lineTo(x + 3.5, y + 1);
    ctx.moveTo(x + 3.5, y + 3.5);
    ctx.lineTo(x + 6, y + 3.5);
    ctx.stroke();
};

const drawBatteryIcon = (x, y) => {
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y + 2, 15, 6);
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(x + 15, y + 3, 2, 4);
    ctx.fillStyle = '#50C878';
    ctx.fillRect(x + 1, y + 3, 13, 4);
};

const drawStatusBar = () => {
    ctx.save();
    
    const statusBarGradient = ctx.createLinearGradient(0, 0, 0, STATUS_BAR_CONFIG.height);
    statusBarGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    statusBarGradient.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
    ctx.fillStyle = statusBarGradient;
    ctx.fillRect(0, 0, 400, STATUS_BAR_CONFIG.height);
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 1;
    
    const currentTime = new Date();

    ctx.save();
    ctx.globalAlpha = 1 - internetTextFadeProgress;
    drawStatusBarPill(4, 76, 'rgba(100, 180, 255, 0.3)', drawWiFiIcon, 'Internet');
    
    ctx.globalAlpha = internetTextFadeProgress;
    drawStatusBarPill(4, 76, 'rgba(100, 180, 255, 0.3)', drawWiFiIcon, 'GolyBidoof');
    ctx.globalAlpha = 1;
    ctx.restore();

    const totalSeries = libraryApps.length;
    const totalVolumes = libraryApps.reduce((sum, app) => sum + (app.volumes ? app.volumes.length : 1), 0);
    
    ctx.save();
    ctx.globalAlpha = 1 - statusBarFadeProgress;
    drawStatusBarPill(84, 70, 'rgba(255, 200, 100, 0.3)', drawBookIcon, `${totalSeries} Series`);
    
    ctx.globalAlpha = statusBarFadeProgress;
    drawStatusBarPill(84, 70, 'rgba(255, 200, 100, 0.3)', drawVolumesIcon, `${totalVolumes} Vols`);
    ctx.globalAlpha = 1;
    ctx.restore();

    if (totalPagesRead > 0) {
        const formattedPages = totalPagesRead >= 10000 ? `${Math.floor(totalPagesRead/1000)}K` : totalPagesRead.toLocaleString();
        drawStatusBarPill(158, 56, 'rgba(150, 255, 150, 0.3)', (x, y) => drawPageIcon(x, y - 1), formattedPages);
    }

    const dateString = `${String(currentTime.getDate()).padStart(2, '0')}/${String(currentTime.getMonth() + 1).padStart(2, '0')}/${currentTime.getFullYear()}`;
    drawStatusBarPill(228, 82, 'rgba(255, 150, 150, 0.3)', (x, y) => drawCalendarIcon(x, y - 1), dateString);

    const timeString = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    drawStatusBarPill(314, 52, 'rgba(200, 150, 255, 0.3)', (x, y) => drawClockIcon(x, y), timeString, 'right');

    drawStatusBarPill(370, 24, 'rgba(100, 255, 200, 0.3)', (x, y) => drawBatteryIcon(x, y - 1), '', 'right');
    
    ctx.shadowBlur = 0;
    ctx.restore();
};

const drawStar = (x, y, size, fillPercent = 1) => {
    const outerRadius = size;
    const innerRadius = size * 0.4;
    
    ctx.save();
    ctx.translate(x, y);
    
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const pointX = Math.cos(angle) * radius;
        const pointY = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(pointX, pointY);
        else ctx.lineTo(pointX, pointY);
    }
    ctx.closePath();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    
    if (fillPercent > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-outerRadius, -outerRadius, outerRadius * 2 * fillPercent, outerRadius * 2);
        ctx.clip();
        
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const angle = (i * Math.PI) / 5 - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const pointX = Math.cos(angle) * radius;
            const pointY = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(pointX, pointY);
            else ctx.lineTo(pointX, pointY);
        }
        ctx.closePath();
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.restore();
    }
    
    ctx.restore();
};

const drawStarRating = (x, y, rating, starSize = 6) => {
    const starSpacing = starSize * 2.5;
    for (let i = 0; i < 5; i++) {
        const starX = x + (i * starSpacing);
        const fillAmount = Math.max(0, Math.min(1, rating - i));
        drawStar(starX, y, starSize, fillAmount);
    }
};

const drawBookCard = (appData) => {
    let currentImage = loadedImages[appData.id];
    let nextImage = null;
    
    if (appData.volumes && appData.volumes.length > 0) {
        const currentVolume = appData.volumes[currentVolumeIndex % appData.volumes.length];
        if (currentVolume?.imageId && loadedImages[currentVolume.imageId]) {
            currentImage = loadedImages[currentVolume.imageId];
        }
        
        if (nextVolumeIndex >= 0 && volumeCrossfadeProgress > 0) {
            const nextVolume = appData.volumes[nextVolumeIndex % appData.volumes.length];
            if (nextVolume?.imageId && loadedImages[nextVolume.imageId]) {
                nextImage = loadedImages[nextVolume.imageId];
            }
        }
    }

    ctx.save();

    let rotationY = 0, rotationX = 0, rotationZ = 0;
    let wobbleFloatEffect = Math.sin(wobbleAnimationTime * 1.5) * 0.3;
    let scaleEffect = 1.0;
    
    if (pageFlipDirection !== 0 && pageFlipProgress > 0) {
        const easedProgress = pageFlipProgress < 0.5 
            ? 4 * pageFlipProgress * pageFlipProgress * pageFlipProgress 
            : 1 - Math.pow(-2 * pageFlipProgress + 2, 3) / 2;
        
        rotationY = easedProgress * 2 * Math.PI * pageFlipDirection;
        
        const shrinkAmount = Math.sin(pageFlipProgress * Math.PI);
        const elasticBounce = Math.sin(pageFlipProgress * Math.PI * 3) * 0.02 * shrinkAmount;
        scaleEffect = 1.0 - shrinkAmount * 0.12 + elasticBounce;
        
        rotationX = Math.sin(pageFlipProgress * Math.PI * 2) * 0.05;
        wobbleFloatEffect = 0;
    } else {
        rotationY = (Math.sin(wobbleAnimationTime * 1.2) - 0.5) * 8 * (Math.PI / 180);
        rotationX = Math.sin(wobbleAnimationTime * 0.9) * 1.5 * (Math.PI / 180);
        rotationZ = Math.sin(wobbleAnimationTime * 1.0) * 1 * (Math.PI / 180);
    }

    const centerX = BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width / 2;
    const centerY = BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height / 2;
    
    const cosY = Math.cos(rotationY);
    const sinY = Math.sin(rotationY);
    const cosX = Math.cos(rotationX);
    const sinX = Math.sin(rotationX);
    const cosZ = Math.cos(rotationZ);
    const sinZ = Math.sin(rotationZ);
    
    ctx.translate(centerX, centerY + wobbleFloatEffect);
    const perspectiveScaleX = scaleEffect * (1 - Math.abs(sinY) * 0.15);
    const perspectiveScaleY = scaleEffect * (1 + Math.abs(sinX) * 0.08);
    ctx.scale(perspectiveScaleX, perspectiveScaleY);
    ctx.transform(cosY * cosZ, sinZ, 0, cosX, 0, 0);
    ctx.translate(-centerX, -centerY);

    const showingBackCover = Math.abs(rotationY) > Math.PI / 2 && Math.abs(rotationY) < 3 * Math.PI / 2;
    
    const visibleSpineWidth = Math.max(2, BOOK_DIMENSIONS.spineDepth * Math.abs(Math.min(0, sinY)));
    const visiblePagesDepth = Math.max(0, BOOK_DIMENSIONS.pagesDepth * Math.max(0, sinY));
    const topBottomDepthAmount = Math.abs(sinY) * BOOK_DIMENSIONS.spineDepth;
    const depthVisibilityAmount = Math.abs(sinY);
    
    const shadowScale = 0.5 + (scaleEffect * 0.5);
    const shadowOffsetX = 5 * shadowScale;
    const shadowOffsetY = 5 * shadowScale;
    const shadowOpacity = 0.3 * shadowScale;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.fillRect(
        BOOK_DIMENSIONS.x + shadowOffsetX, 
        BOOK_DIMENSIONS.y + shadowOffsetY, 
        Math.abs(BOOK_DIMENSIONS.width * cosY * shadowScale), 
        BOOK_DIMENSIONS.height * shadowScale
    );
    
    if (depthVisibilityAmount > 0.3 && sinX < 0.5) {
        const topEdgeDepth = topBottomDepthAmount * 0.8;
        const topEdgeGradient = ctx.createLinearGradient(BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y - topEdgeDepth, BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y);
        topEdgeGradient.addColorStop(0, '#2a2a2a');
        topEdgeGradient.addColorStop(1, '#4a4a4a');
        ctx.fillStyle = topEdgeGradient;
        ctx.fillRect(BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y - topEdgeDepth, BOOK_DIMENSIONS.width, topEdgeDepth);
    }
    
    if (depthVisibilityAmount > 0.3 && sinX > -0.5) {
        const bottomEdgeDepth = topBottomDepthAmount * 0.8;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height, BOOK_DIMENSIONS.width, bottomEdgeDepth);
    }

    if (visiblePagesDepth > 0.5 && !showingBackCover) {
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(BOOK_DIMENSIONS.x - visiblePagesDepth, BOOK_DIMENSIONS.y, visiblePagesDepth, BOOK_DIMENSIONS.height);
        
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < BOOK_DIMENSIONS.height; i += 3) {
            ctx.beginPath();
            ctx.moveTo(BOOK_DIMENSIONS.x - visiblePagesDepth, BOOK_DIMENSIONS.y + i);
            ctx.lineTo(BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y + i);
            ctx.stroke();
        }
    }

    if (showingBackCover) {
        const backCoverGradient = ctx.createLinearGradient(BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y, BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height);
        backCoverGradient.addColorStop(0, '#f5f5f5');
        backCoverGradient.addColorStop(1, '#e8e8e8');
        ctx.fillStyle = backCoverGradient;
        ctx.fillRect(BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y, BOOK_DIMENSIONS.width, BOOK_DIMENSIONS.height);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y, BOOK_DIMENSIONS.width, BOOK_DIMENSIONS.height);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y, BOOK_DIMENSIONS.width, BOOK_DIMENSIONS.height);

        if (currentImage) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y, BOOK_DIMENSIONS.width, BOOK_DIMENSIONS.height);
            ctx.clip();
            
            const imageScale = BOOK_DIMENSIONS.height / currentImage.height;
            const scaledImageWidth = currentImage.width * imageScale;
            const imageOffsetX = BOOK_DIMENSIONS.x + (BOOK_DIMENSIONS.width - scaledImageWidth) / 2;
            
            if (nextImage && volumeCrossfadeProgress > 0 && volumeCrossfadeProgress < 1) {
                ctx.globalAlpha = 1 - volumeCrossfadeProgress;
                ctx.drawImage(currentImage, imageOffsetX, BOOK_DIMENSIONS.y, scaledImageWidth, BOOK_DIMENSIONS.height);
                
                const nextImageScale = BOOK_DIMENSIONS.height / nextImage.height;
                const nextScaledWidth = nextImage.width * nextImageScale;
                const nextImageOffsetX = BOOK_DIMENSIONS.x + (BOOK_DIMENSIONS.width - nextScaledWidth) / 2;
                
                ctx.globalAlpha = volumeCrossfadeProgress;
                ctx.drawImage(nextImage, nextImageOffsetX, BOOK_DIMENSIONS.y, nextScaledWidth, BOOK_DIMENSIONS.height);
                
                ctx.globalAlpha = 1;
            } else {
                ctx.drawImage(currentImage, imageOffsetX, BOOK_DIMENSIONS.y, scaledImageWidth, BOOK_DIMENSIONS.height);
            }
            
            ctx.restore();
        }

        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(BOOK_DIMENSIONS.x, BOOK_DIMENSIONS.y, BOOK_DIMENSIONS.width, BOOK_DIMENSIONS.height);
        
        if (appData.volumes && appData.volumes.length > 1) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(BOOK_DIMENSIONS.x + 5, BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height - 25, 70, 20);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Verdana, Geneva, sans-serif';
            ctx.textAlign = 'center';
            
            const displayIndex = (nextVolumeIndex >= 0 && volumeCrossfadeProgress > 0) ? nextVolumeIndex : currentVolumeIndex;
            const displayVolume = appData.volumes[displayIndex % appData.volumes.length];
            const volumeNumber = displayVolume?.volumeNumber || (displayIndex + 1);
            ctx.fillText(`Vol. ${volumeNumber} (${displayIndex + 1}/${appData.volumes.length})`, BOOK_DIMENSIONS.x + 40, BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height - 11);
        }
    }

    const spineVisibilityBoost = (pageFlipDirection !== 0) ? (1 + depthVisibilityAmount * 0.5) : 1;
    const actualSpineWidth = (visibleSpineWidth + 8) * spineVisibilityBoost;
    
    const spineGradient = ctx.createLinearGradient(
        BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width, BOOK_DIMENSIONS.y,
        BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width + actualSpineWidth, BOOK_DIMENSIONS.y
    );
    spineGradient.addColorStop(0, '#4a4a4a');
    spineGradient.addColorStop(0.5, '#2a2a2a');
    spineGradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = spineGradient;
    ctx.fillRect(BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width, BOOK_DIMENSIONS.y, actualSpineWidth, BOOK_DIMENSIONS.height);
    
    const highlightAlpha = (pageFlipDirection !== 0) ? 0.15 : 0.08;
    ctx.fillStyle = `rgba(255, 255, 255, ${highlightAlpha})`;
    ctx.fillRect(BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width, BOOK_DIMENSIONS.y, actualSpineWidth, 12);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width, BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height - 12, actualSpineWidth, 12);
    
    if (pageFlipDirection !== 0 && depthVisibilityAmount > 0.4) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width + 3, BOOK_DIMENSIONS.y + 10);
        ctx.lineTo(BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width + 3, BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height - 10);
        ctx.stroke();
    }

    ctx.restore();

    if (!showingBackCover) {
        drawRatingPanel(appData, 8, BOOK_DIMENSIONS.y);
        drawInfoPanel(appData, BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width + 18, BOOK_DIMENSIONS.y);
    }
};

const drawRatingPanel = (appData, x, y) => {
    const panelWidth = 100;
    
    ctx.save();
    
    if (pageFlipDirection !== 0 && pageFlipProgress > 0 && pageFlipProgress < 1) {
        ctx.globalAlpha = calculateFadeAlpha(pageFlipProgress);
    }
    
    ctx.textAlign = 'center';
    const centerX = x + panelWidth / 2;
    let currentY = y;

    let averageRating = appData.rating;
    let averageEntertainmentRating = appData.entertainmentRating;
    let averageLanguageRating = appData.languageLearningRating;
    
    if (appData.volumes && appData.volumes.length > 1) {
        const ratingTotals = { rating: 0, entertainment: 0, language: 0 };
        const ratingCounts = { rating: 0, entertainment: 0, language: 0 };
        
        appData.volumes.forEach(volume => {
            if (volume.rating > 0) { ratingTotals.rating += volume.rating; ratingCounts.rating++; }
            if (volume.entertainmentRating) { ratingTotals.entertainment += volume.entertainmentRating; ratingCounts.entertainment++; }
            if (volume.languageLearningRating) { ratingTotals.language += volume.languageLearningRating; ratingCounts.language++; }
        });
        
        if (ratingCounts.rating > 0) averageRating = ratingTotals.rating / ratingCounts.rating;
        if (ratingCounts.entertainment > 0) averageEntertainmentRating = ratingTotals.entertainment / ratingCounts.entertainment;
        if (ratingCounts.language > 0) averageLanguageRating = ratingTotals.language / ratingCounts.language;
    }
    
    if (appData.level !== null) {
        const levelColorMap = {
            13: 'rgb(248, 100, 100)', 20: 'rgb(111, 66, 193)', 
            27: 'rgb(253, 126, 20)', 34: 'rgb(92, 184, 92)', 
            0: 'rgb(100, 150, 220)', 41: 'rgb(255, 215, 0)'
        };
        const levelColor = Object.keys(levelColorMap).reverse().find(key => appData.level >= parseInt(key)) 
            ? levelColorMap[Object.keys(levelColorMap).reverse().find(key => appData.level >= parseInt(key))]
            : levelColorMap[0];

        drawRoundedRect(ctx, {
            x: x + 10,
            y: currentY,
            width: panelWidth - 20,
            height: 36,
            radius: 8,
            fill: levelColor
        });

        drawText(ctx, { text: 'LEVEL', x: centerX, y: currentY + 12, font: '8px Verdana, Geneva, sans-serif', color: '#ffffff', align: 'center' });
        drawText(ctx, { text: appData.level.toString(), x: centerX, y: currentY + 30, font: 'bold 18px Verdana, Geneva, sans-serif', color: '#ffffff', align: 'center' });
        currentY += 42;
    }
    
    if (averageRating > 0) {
        drawGlassPanel(ctx, {
            x: x + 10,
            y: currentY,
            width: panelWidth - 20,
            height: 38,
            radius: 6,
            stroke: '#20c997'
        });

        drawText(ctx, { text: 'RATING', x: centerX, y: currentY + 9, font: 'bold 7px Verdana, Geneva, sans-serif', align: 'center' });
        
        const starSize = 6;
        const starSpacing = starSize * 2.5;
        const totalStarWidth = 4 * starSpacing + 2 * starSize - 12;
        drawStarRating(centerX - totalStarWidth / 2, currentY + 22, averageRating, starSize);
        currentY += 44;
    }
    
    if (averageEntertainmentRating || averageLanguageRating) {
        const widgetHeight = (averageEntertainmentRating && averageLanguageRating) ? 54 : 30;
        
        drawGlassPanel(ctx, {
            x: x + 10,
            y: currentY,
            width: panelWidth - 20,
            height: widgetHeight,
            radius: 6
        });
        
        let innerY = currentY + 4;
        
        if (averageEntertainmentRating) {
            drawText(ctx, { text: 'ENTERTAINMENT', x: centerX, y: innerY + 5, font: 'bold 7px Verdana, Geneva, sans-serif', align: 'center' });

            const starSize = 5;
            const starSpacing = starSize * 2.5;
            const totalStarWidth = 4 * starSpacing + 2 * starSize - 12;
            drawStarRating(centerX - totalStarWidth / 2, innerY + 16, averageEntertainmentRating, starSize);
            innerY += 26;
        }
        
        if (averageLanguageRating) {
            drawText(ctx, { text: 'LANG. LEARNING', x: centerX, y: innerY + 5, font: 'bold 7px Verdana, Geneva, sans-serif', align: 'center' });

            const starSize = 5;
            const starSpacing = starSize * 2.5;
            const totalStarWidth = 4 * starSpacing + 2 * starSize - 12;
            drawStarRating(centerX - totalStarWidth / 2, innerY + 16, averageLanguageRating, starSize);
        }
        
        currentY += widgetHeight + 6;
    }
    
    if (appData.volumes && appData.volumes.length > 1) {
        drawGlassPanel(ctx, {
            x: x + 10,
            y: currentY,
            width: panelWidth - 20,
            height: 32,
            radius: 6,
            fill: 'rgba(255, 255, 255, 0.08)',
            stroke: 'rgba(255, 255, 255, 0.2)'
        });

        drawText(ctx, { text: `${appData.volumes.length} Volumes`, x: centerX, y: currentY + 20, font: 'bold 11px Verdana, Geneva, sans-serif', align: 'center' });
        currentY += 38;
    }
    
    if (appData.volumes && appData.volumes.length > 1) {
        let totalSeriesPages = 0;
        appData.volumes.forEach(volume => {
            if (volume.pageCount) totalSeriesPages += volume.pageCount;
        });
        
        if (totalSeriesPages > 0) {
            drawGlassPanel(ctx, {
                x: x + 10,
                y: currentY,
                width: panelWidth - 20,
                height: 28,
                radius: 6,
                fill: 'rgba(255, 255, 255, 0.05)',
                stroke: 'rgba(255, 255, 255, 0.15)'
            });

            drawText(ctx, { text: `${totalSeriesPages.toLocaleString()} pages`, x: centerX, y: currentY + 17, font: 'bold 9px Verdana, Geneva, sans-serif', align: 'center' });
        }
    }
    
    ctx.restore();
};

const drawInfoPanel = (appData, x, y) => {
    const panelWidth = 400 - x - 5;
    const textLineHeight = 12;
    let currentY = y + 14;
    
    ctx.save();
    
    if (pageFlipDirection !== 0 && pageFlipProgress > 0 && pageFlipProgress < 1) {
        ctx.globalAlpha = calculateFadeAlpha(pageFlipProgress);
    }

    const panelHeight = BOOK_DIMENSIONS.height;
    drawGlassPanel(ctx, {
        x,
        y,
        width: panelWidth,
        height: panelHeight,
        radius: 8,
        fill: 'rgba(0, 0, 0, 0.18)',
        stroke: 'rgba(255, 255, 255, 0.12)'
    });
    
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;

    let displayTitle = appData.name;
    if (appData.volumes && appData.volumes.length === 1 && appData.volumes[0].volumeNumber) {
        displayTitle = `${appData.name} ${appData.volumes[0].volumeNumber}`;
    }
    
    const titleLines = wrapTextToLines(ctx, displayTitle, panelWidth - 8, 3);
    titleLines.forEach(line => {
        drawText(ctx, { text: line, x: x + 10, y: currentY, font: 'bold 10px Verdana, Geneva, sans-serif' });
        currentY += textLineHeight + 2;
    });
    
    currentY += 3;
    
    if (appData.author) {
        drawText(ctx, {
            text: truncateTextWithEllipsis(ctx, appData.author, panelWidth - 14),
            x: x + 10,
            y: currentY,
            font: '7px Verdana, Geneva, sans-serif',
            color: 'rgba(255, 255, 255, 0.8)'
        });
        currentY += textLineHeight;
    }

    currentY += 5;

    const statusColorMap = {
        'Reading': '#4A90E2',
        'Finished': '#50C878',
        'Wish list': '#F39C12',
        'Stopped': '#E74C3C'
    };
    
    ctx.fillStyle = statusColorMap[appData.status] || '#999';
    ctx.beginPath();
    ctx.arc(x + 10, currentY - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    drawText(ctx, { text: appData.status, x: x + 20, y: currentY, font: 'bold 8px Verdana, Geneva, sans-serif' });
    
    if (appData.dateFinished && (!appData.volumes || appData.volumes.length <= 1)) {
        let formattedDate = appData.dateFinished;
        try {
            const date = new Date(appData.dateFinished);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            formattedDate = `${day}/${month}/${year}`;
        } catch (error) {
            formattedDate = 'Invalid date';
        }
        
        drawText(ctx, { text: formattedDate, x: x + 20, y: currentY + textLineHeight, font: '7px Verdana, Geneva, sans-serif', color: 'rgba(255, 255, 255, 0.7)' });
        currentY += textLineHeight * 2 + 2;
    } else {
        currentY += textLineHeight + 2;
    }
    
    let mediaInfoText = '';
    if (appData.mediaType) mediaInfoText += appData.mediaType;
    if (appData.pageCount) {
        if (mediaInfoText) mediaInfoText += ' | ';
        mediaInfoText += `${appData.pageCount}p`;
    }
    drawText(ctx, { text: mediaInfoText, x: x + 10, y: currentY, font: '7px Verdana, Geneva, sans-serif', color: 'rgba(255, 255, 255, 0.9)' });
    currentY += textLineHeight + 2;
    
    ctx.shadowBlur = 0;
    
    if (appData.volumes && appData.volumes.length > 1) {
        currentY += 2;
        const remainingHeight = (y + BOOK_DIMENSIONS.height) - currentY;
        const listAreaHeight = Math.max(0, remainingHeight - 20);
        drawVolumeList(appData.volumes, x + 8, currentY, panelWidth - 16, Math.max(10, listAreaHeight - 12));
    }
    
    ctx.restore();
};

const drawVolumeList = (volumes, x, y, width, maxVisibleHeight = 100) => {
    const volumeLineHeight = 13;
    const totalContentHeight = volumes.length * volumeLineHeight;
    
    const formatCompactDate = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (error) {
            return 'Invalid date';
        }
    };
    
    ctx.save();
    
    drawRoundedRect(ctx, {
        x: x - 2,
        y,
        width: width + 4,
        height: 18,
        radius: 6,
        fill: 'rgba(255, 255, 255, 0.1)',
        stroke: 'rgba(255, 255, 255, 0.15)'
    });
    drawText(ctx, { text: 'VOLUMES', x: x + 2, y: y + 12, font: 'bold 8px Verdana, Geneva, sans-serif' });
    
    const listStartY = y + 20;
    ctx.beginPath();
    ctx.rect(x - 2, listStartY, width + 4, maxVisibleHeight);
    ctx.clip();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(x - 2, listStartY, width + 4, maxVisibleHeight);
    
    const maximumScroll = Math.max(0, totalContentHeight - maxVisibleHeight);
    volumeListScrollPosition = Math.max(0, Math.min(volumeListScrollPosition, maximumScroll));
    
    let currentY = listStartY + 12 - volumeListScrollPosition;
    volumes.forEach((volume, volumeIndex) => {
        if (currentY > listStartY - volumeLineHeight && currentY < listStartY + maxVisibleHeight + volumeLineHeight) {
            if (volumeIndex === currentVolumeIndex) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.fillRect(x - 2, currentY - 9, width + 4, volumeLineHeight);
            }

            const volumeId = volume.volumeNumber ? `Vol. ${volume.volumeNumber}` : `Vol. ${volumeIndex + 1}`;
            drawText(ctx, {
                text: volumeId,
                x: x + 2,
                y: currentY,
                font: 'bold 8px Verdana, Geneva, sans-serif',
                color: volumeIndex === currentVolumeIndex ? '#FFD700' : 'rgba(255, 255, 255, 0.9)'
            });

            const rightSideText = volume.dateFinished ? formatCompactDate(volume.dateFinished) : (volume.status || '');
            if (rightSideText) {
                drawText(ctx, {
                    text: rightSideText,
                    x: x + width - 4,
                    y: currentY,
                    font: '7px Verdana, Geneva, sans-serif',
                    color: 'rgba(255, 255, 255, 0.6)',
                    align: 'right'
                });
            }
        }
        currentY += volumeLineHeight;
    });
    
    ctx.restore();
    
    if (totalContentHeight > maxVisibleHeight) {
        const scrollbarHeight = Math.max(20, (maxVisibleHeight / totalContentHeight) * maxVisibleHeight);
        const scrollbarY = listStartY + (volumeListScrollPosition / maximumScroll) * (maxVisibleHeight - scrollbarHeight);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x + width + 1, scrollbarY, 2, scrollbarHeight);
    }
};

const drawPageIndicator = () => {
    const centerX = 200;
    const indicatorY = 224;
    
    if (totalPageCount > 0) {
        ctx.save();
        
        ctx.font = 'bold 9px Verdana, Geneva, sans-serif';
        const pageText = `${currentPageIndex + 1} / ${totalPageCount}`;
        const textWidth = ctx.measureText(pageText).width;
        const pillWidth = textWidth + 20;
        const pillHeight = 14;
        const pillX = centerX - pillWidth / 2;
        
        drawRoundedRect(ctx, {
            x: pillX,
            y: indicatorY,
            width: pillWidth,
            height: pillHeight,
            radius: pillHeight / 2,
            fill: 'rgba(255, 255, 255, 0.15)',
            stroke: 'rgba(255, 255, 255, 0.25)'
        });

        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 1;
        drawText(ctx, { text: pageText, x: centerX, y: indicatorY + 10, font: 'bold 9px Verdana, Geneva, sans-serif', align: 'center' });
        ctx.shadowBlur = 0;
        
        ctx.restore();
    }
};

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://YOUR-APP-NAME.onrender.com';

const fetchReadingStats = async () => {
    try {
        const response = await fetch(`${API_BASE}/api/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                endpoint: 'stats',
                body: { year: new Date().getFullYear() }
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.totalPagesRead !== undefined) {
                totalPagesRead = data.totalPagesRead;
            }
        }
    } catch (error) {
        throw new Error(`Failed to fetch reading stats: ${error.message}`);
    }
};

const fetchLibraryData = async () => {
    try {
        const response = await fetch(`${API_BASE}/api/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: 'library',
                body: {
                    page: 1,
                    numOfPages: 1,
                    totalCount: 0,
                    libraryType: "books",
                    sort: "-recent",
                    pageSize: 50
                }
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const rawApps = data.results.map(result => ({
                name: result.item?.title || 'Unknown',
                seriesTitle: result.item?.seriesTitle || '',
                imageUrl: result.item?.image?.url || null,
                level: result.item?.rating?.lvl || null,
                status: result.statusDisplay || 'Unknown',
                dateStarted: result.dateStartedData?.display || null,
                dateFinished: result.dateFinishedData?.display || null,
                dateFinishedTimestamp: result.dateFinishedData?.timestampDate || 0,
                pageCount: result.item?.pageCount || null,
                author: result.item?.author || null,
                mediaType: result.item?.mediaTypeDisplay || null,
                rating: result.review?.rating || null,
                entertainmentRating: result.review?.entertainmentRating || null,
                languageLearningRating: result.review?.languageLearningRating || null,
                id: result.item?.id || Math.random()
            }));
            
            const seriesMap = {};
            rawApps.forEach(app => {
                const seriesName = app.seriesTitle || app.name.replace(/\s*[(\uff08]\d+[)\uff09]\s*$/, '').replace(/\s*\d+\s*$/, '').trim();
                
                if (!seriesMap[seriesName]) {
                    seriesMap[seriesName] = {
                        ...app,
                        name: seriesName,
                        volumes: [],
                        volumeImages: []
                    };
                }
                
                const volumeMatch = app.name.match(/(\d+)[)\uff09]?\s*$/);
                const volumeNumber = volumeMatch ? parseInt(volumeMatch[1]) : seriesMap[seriesName].volumes.length + 1;
                
                seriesMap[seriesName].volumes.push({
                    volumeName: app.name,
                    volumeNumber: volumeNumber,
                    dateFinished: app.dateFinished,
                    dateFinishedTimestamp: app.dateFinishedTimestamp,
                    dateStarted: app.dateStarted,
                    status: app.status,
                    rating: app.rating,
                    pageCount: app.pageCount,
                    imageId: app.id,
                    imageUrl: app.imageUrl
                });
                
                seriesMap[seriesName].volumeImages.push({
                    id: app.id,
                    url: app.imageUrl
                });
                
                if (app.dateFinishedTimestamp > seriesMap[seriesName].dateFinishedTimestamp) {
                    seriesMap[seriesName].dateFinishedTimestamp = app.dateFinishedTimestamp;
                    seriesMap[seriesName].dateFinished = app.dateFinished;
                }
            });
            
            libraryApps = Object.values(seriesMap);
            
            libraryApps.forEach(app => {
                if (app.volumes && app.volumes.length > 1) {
                    app.volumes.sort((a, b) => {
                        if (a.volumeNumber !== b.volumeNumber) {
                            return a.volumeNumber - b.volumeNumber;
                        }
                        return b.dateFinishedTimestamp - a.dateFinishedTimestamp;
                    });
                }
            });
            
            libraryApps.sort((a, b) => b.dateFinishedTimestamp - a.dateFinishedTimestamp);
            
            totalPageCount = libraryApps.length;
            await preloadImages();
        }
        
        isLoading = false;
    } catch (error) {
        libraryApps = [];
        isLoading = false;
        hasError = true;
        errorMessage = `Failed to load data: ${error.message}`;
    }
};

const preloadImages = async () => {
    const imageLoadPromises = [];
    
    libraryApps.forEach(app => {
        if (app.imageUrl) {
            imageLoadPromises.push(new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => { loadedImages[app.id] = img; resolve(); };
                img.onerror = () => reject(new Error(`Failed to load image for ${app.name}`));
                img.src = app.imageUrl;
            }));
        }
        
        if (app.volumeImages && app.volumeImages.length > 0) {
            app.volumeImages.forEach(volumeImage => {
                if (volumeImage.url) {
                    imageLoadPromises.push(new Promise((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => { loadedImages[volumeImage.id] = img; resolve(); };
                        img.onerror = () => reject(new Error(`Failed to load volume image`));
                        img.src = volumeImage.url;
                    }));
                }
            });
        }
    });

    await Promise.all(imageLoadPromises);
};

const drawHomeMenu = () => {
    const currentFrameTime = performance.now() / 1000;
    const deltaTime = previousFrameTime === 0 ? 0.016 : Math.min(currentFrameTime - previousFrameTime, 0.1);
    previousFrameTime = currentFrameTime;
    
    ctx.clearRect(0, 0, 400, 240);
    drawBackground();

    if (isLoading) {
        ctx.fillStyle = COLORS.text;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 2;
        ctx.fillText('Loading library...', 200, 120);
        ctx.shadowBlur = 0;
        drawPageIndicator();
        drawStatusBar();
        return;
    }

    if (hasError) {
        ctx.fillStyle = '#FF6B6B';
        ctx.font = 'bold 14px Verdana, Geneva, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ERROR', 200, 100);
        
        ctx.fillStyle = COLORS.text;
        ctx.font = '10px Verdana, Geneva, sans-serif';
        ctx.fillText(errorMessage, 200, 130);
        
        drawPageIndicator();
        drawStatusBar();
        return;
    }

    if (libraryApps.length > 0 && currentPageIndex < libraryApps.length) {
        drawBookCard(libraryApps[currentPageIndex]);
    }

    drawPageIndicator();
    drawStatusBar();
    
    wobbleAnimationTime += deltaTime;
    
    internetTextTimer += deltaTime;
    if (internetTextTimer < ANIMATION_TIMING.statusCycle) {
        internetTextFadeProgress = Math.max(0, internetTextFadeProgress - deltaTime * (1 / ANIMATION_TIMING.statusFade));
    } else if (internetTextTimer < ANIMATION_TIMING.statusCycle * 2) {
        const fadeTime = internetTextTimer - ANIMATION_TIMING.statusCycle;
        internetTextFadeProgress = fadeTime < ANIMATION_TIMING.statusFade ? fadeTime / ANIMATION_TIMING.statusFade : 1;
    } else {
        internetTextTimer = 0;
    }
    
    statusBarCycleTimer += deltaTime;
    if (statusBarCycleTimer < ANIMATION_TIMING.statusCycle) {
        statusBarFadeProgress = Math.max(0, statusBarFadeProgress - deltaTime * (1 / ANIMATION_TIMING.statusFade));
    } else if (statusBarCycleTimer < ANIMATION_TIMING.statusCycle * 2) {
        const fadeTime = statusBarCycleTimer - ANIMATION_TIMING.statusCycle;
        statusBarFadeProgress = fadeTime < ANIMATION_TIMING.statusFade ? fadeTime / ANIMATION_TIMING.statusFade : 1;
    } else {
        statusBarCycleTimer = 0;
    }
    
    if (pageFlipDirection !== 0) {
        pageFlipProgress += deltaTime * ANIMATION_TIMING.flipSpeed;
        
        if (pageFlipProgress >= 0.5 && targetPageIndex >= 0) {
            currentPageIndex = targetPageIndex;
            targetPageIndex = -1;
            currentVolumeIndex = 0;
            nextVolumeIndex = -1;
            volumeDisplayTimer = 0;
            volumeCrossfadeProgress = 0;
        }
        
        if (pageFlipProgress >= 1) {
            pageFlipProgress = 0;
            pageFlipDirection = 0;
        }
    } else {
        const currentApp = libraryApps[currentPageIndex];
        if (currentApp?.volumes && currentApp.volumes.length > 1) {
            volumeDisplayTimer += deltaTime;
            
            const waitTime = (currentVolumeIndex === 0) ? ANIMATION_TIMING.volumeFirstDelay : ANIMATION_TIMING.volumeDisplay;
            
            if (volumeDisplayTimer < waitTime) {
                nextVolumeIndex = -1;
                volumeCrossfadeProgress = 0;
            } else if (volumeDisplayTimer >= waitTime && volumeDisplayTimer < waitTime + ANIMATION_TIMING.volumeFade) {
                if (nextVolumeIndex < 0) {
                    nextVolumeIndex = (currentVolumeIndex + 1) % currentApp.volumes.length;
                }
                volumeCrossfadeProgress = (volumeDisplayTimer - waitTime) / ANIMATION_TIMING.volumeFade;
            } else {
                currentVolumeIndex = (currentVolumeIndex + 1) % currentApp.volumes.length;
                nextVolumeIndex = -1;
                volumeCrossfadeProgress = 0;
                volumeDisplayTimer = 0;
            }
        }
    }
};

const navigateToNextPage = () => {
    if (currentPageIndex < totalPageCount - 1 && pageFlipDirection === 0) {
        targetPageIndex = currentPageIndex + 1;
        pageFlipDirection = 1;
        pageFlipProgress = 0;
        currentVolumeIndex = 0;
        nextVolumeIndex = -1;
        volumeDisplayTimer = 0;
        volumeCrossfadeProgress = 0;
        volumeListScrollPosition = 0;
    }
};

const navigateToPreviousPage = () => {
    if (currentPageIndex > 0 && pageFlipDirection === 0) {
        targetPageIndex = currentPageIndex - 1;
        pageFlipDirection = -1;
        pageFlipProgress = 0;
        currentVolumeIndex = 0;
        nextVolumeIndex = -1;
        volumeDisplayTimer = 0;
        volumeCrossfadeProgress = 0;
        volumeListScrollPosition = 0;
    }
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') navigateToNextPage();
    else if (e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'H') navigateToPreviousPage();
    else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') volumeListScrollPosition = Math.max(0, volumeListScrollPosition - 26);
    else if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') volumeListScrollPosition += 26;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    volumeListScrollPosition += e.deltaY * 0.5;
}, { passive: false });

canvas.addEventListener('click', (e) => {
    const canvasBounds = canvas.getBoundingClientRect();
    const clickX = (e.clientX - canvasBounds.left) * (400 / canvasBounds.width);
    clickX > 200 ? navigateToNextPage() : navigateToPreviousPage();
});

const startAnimationLoop = () => {
    drawHomeMenu();
    requestAnimationFrame(startAnimationLoop);
};

startAnimationLoop();
Promise.all([fetchLibraryData(), fetchReadingStats()]);
