const canvas = document.getElementById("homeMenu");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
const resizeCanvas = () => {
    const padding = 100;
    const w = window.innerWidth - padding;
    const h = window.innerHeight - padding;
    const scale = Math.max(1, Math.min(Math.floor(w / 400), Math.floor(h / 240)));
    canvas.style.width = 400 * scale + "px";
    canvas.style.height = 240 * scale + "px";
};
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
const COLORS = {
    bgTop: "#5eb1e8",
    bgBottom: "#1e75b8",
    text: "#ffffff",
};
const BOOK_DIMENSIONS = {
    width: 140,
    height: 200,
    x: 120,
    y: 22,
    spineDepth: 10,
    pagesDepth: 3,
};
const STATUS_BAR_CONFIG = {
    height: 20,
    pillY: 2,
    pillHeight: 16,
};
const ANIMATION_TIMING = {
    flipSpeed: 1.25,
    volumeFirstDelay: 3.0,
    volumeDisplay: 4.0,
    volumeFade: 0.8,
    statusCycle: 3.0,
    statusFade: 0.6,
};
const drawRoundedRect = (
    ctx,
    { x, y, width, height, radius = 6, fill, stroke, strokeWidth = 1 },
) => {
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
const drawGlassPanel = (
    ctx,
    {
        x,
        y,
        width,
        height,
        radius = 6,
        fill = "rgba(255, 255, 255, 0.12)",
        stroke = "rgba(255, 255, 255, 0.3)",
        strokeWidth = 1,
    },
) =>
    drawRoundedRect(ctx, {
        x,
        y,
        width,
        height,
        radius,
        fill,
        stroke,
        strokeWidth,
    });
const drawText = (
    ctx,
    {
        text,
        x,
        y,
        font,
        color = COLORS.text,
        align = "left",
        baseline = "alphabetic",
    },
) => {
    const saved = {
        font: ctx.font,
        fill: ctx.fillStyle,
        align: ctx.textAlign,
        baseline: ctx.textBaseline,
        smooth: ctx.imageSmoothingEnabled,
    };
    ctx.imageSmoothingEnabled = false;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, Math.round(x), Math.round(y));
    ctx.font = saved.font;
    ctx.fillStyle = saved.fill;
    ctx.textAlign = saved.align;
    ctx.textBaseline = saved.baseline;
    ctx.imageSmoothingEnabled = saved.smooth;
};
let libraryApps = [];
let currentPageIndex = 0;
let totalPageCount = 0;
let loadedImages = {};
let isLoading = true;
let hasError = false;
let errorMessage = "";
let usingFallback = false;
let isConnected = false;
let totalPagesRead = 0;
let volumeListScrollPosition = 0;
let pageFlipDirection = 0;
let pageFlipProgress = 0;
let targetPageIndex = -1;
const SORT_METHODS = [
    { id: "recent", label: "Recent" },
    { id: "volumesRead", label: "Vols Read" },
    { id: "level", label: "Level" },
    { id: "pagesRead", label: "Pages" },
    { id: "chronological", label: "Date" },
    { id: "rating", label: "Rating" },
    { id: "globalRating", label: "Global Rating" },
    { id: "popularity", label: "Popularity" },
];
let currentSortIndex = 0;
let sortDirection = -1;
let wobbleAnimationTime = 0;
let currentVolumeIndex = 0;
let nextVolumeIndex = -1;
let volumeCrossfadeProgress = 0;
let volumeDisplayTimer = 0;
let ratingPanelScrollOffset = 0;
let ratingPanelScrollWaitTimer = 0;
let ratingPanelScrollDirection = 1;
let statusBarCycleTimer = 0;
let statusBarFadeProgress = 0;
let internetTextTimer = 0;
let internetTextFadeProgress = 0;
let previousFrameTime = 0;
let introAnimationProgress = 0;
const floatingBubbles = Array.from({ length: 15 }, () => ({
    x: Math.random() * 400,
    y: Math.random() * 240,
    radius: Math.random() * 30 + 10,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.3,
    opacity: Math.random() * 0.1 + 0.05,
}));
const easeInQuad = (t) => t * t;
const easeOutBack = (t) => {
    const springConstant = 1.70158;
    const adjusted = springConstant + 1;
    return (
        1 + adjusted * Math.pow(t - 1, 3) + springConstant * Math.pow(t - 1, 2)
    );
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
    const characters = text.split("");
    let currentLine = "";
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
        lines[maxLines - 1] = lines[maxLines - 1].slice(0, -3) + "...";
    }
    return lines;
};
const truncateTextWithEllipsis = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (
        ctx.measureText(truncated + "...").width > maxWidth &&
        truncated.length > 0
    ) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + "...";
};
const drawBackground = () => {
    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, 240);
    backgroundGradient.addColorStop(0, COLORS.bgTop);
    backgroundGradient.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, 400, 240);
    const edgeShadows = [
        { x: 0, y: 0, w: 400, h: 2, color: "rgba(255, 255, 255, 0.15)" },
        {
            x: 0,
            y: 0,
            w: 20,
            h: 240,
            gradient: [0, 0, 20, 0, "rgba(0,0,0,0.3)", "rgba(0,0,0,0)"],
        },
        {
            x: 380,
            y: 0,
            w: 20,
            h: 240,
            gradient: [380, 0, 400, 0, "rgba(0,0,0,0)", "rgba(0,0,0,0.3)"],
        },
        {
            x: 0,
            y: 220,
            w: 400,
            h: 20,
            gradient: [0, 220, 0, 240, "rgba(0,0,0,0)", "rgba(0,0,0,0.4)"],
        },
    ];
    edgeShadows.forEach((edge) => {
        if (edge.gradient) {
            const edgeGradient = ctx.createLinearGradient(
                ...edge.gradient.slice(0, 4),
            );
            edgeGradient.addColorStop(0, edge.gradient[4]);
            edgeGradient.addColorStop(1, edge.gradient[5]);
            ctx.fillStyle = edgeGradient;
        } else {
            ctx.fillStyle = edge.color;
        }
        ctx.fillRect(edge.x, edge.y, edge.w, edge.h);
    });
    floatingBubbles.forEach((bubble) => {
        ctx.globalAlpha = bubble.opacity * 0.6;
        const bubbleShadowGradient = ctx.createRadialGradient(
            bubble.x,
            bubble.y + bubble.radius * 0.7,
            0,
            bubble.x,
            bubble.y + bubble.radius * 0.7,
            bubble.radius * 1.4,
        );
        bubbleShadowGradient.addColorStop(0, "rgba(10, 20, 40, 0.25)");
        bubbleShadowGradient.addColorStop(1, "rgba(10, 20, 40, 0)");
        ctx.fillStyle = bubbleShadowGradient;
        ctx.beginPath();
        ctx.ellipse(
            bubble.x,
            bubble.y + bubble.radius * 0.7,
            bubble.radius * 1.2,
            bubble.radius * 0.4,
            0,
            0,
            Math.PI * 2,
        );
        ctx.fill();
        ctx.globalAlpha = bubble.opacity;
        ctx.fillStyle = "#ffffff";
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
const drawStatusBarPill = (
    x,
    width,
    color,
    iconFunction,
    text,
    textAlign = "left",
) => {
    const { pillY, pillHeight } = STATUS_BAR_CONFIG;
    const iconY = pillY + 4;
    const textY = pillY + 11;
    drawRoundedRect(ctx, {
        x,
        y: pillY,
        width,
        height: pillHeight,
        radius: 6,
        fill: color,
    });
    iconFunction(x + 4, iconY);
    const textX = textAlign === "right" ? x + width - 6 : x + 16;
    drawText(ctx, {
        text,
        x: textX,
        y: textY,
        font: "bold 9px Verdana, Geneva, sans-serif",
        align: textAlign,
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
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 3.5, y + 2);
    ctx.lineTo(x + 3.5, y + 7);
    ctx.stroke();
};
const drawVolumesIcon = (x, y) => {
    ctx.fillStyle = COLORS.text;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 1;
    [
        [x + 2, y],
        [x + 1, y + 1],
        [x, y + 2],
    ].forEach((position) => {
        ctx.fillRect(position[0], position[1], 6, 5);
        ctx.strokeRect(position[0], position[1], 6, 5);
    });
};
const drawPageIcon = (x, y) => {
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(x, y + 1, 6, 7);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 1);
    ctx.lineTo(x + 6, y + 1);
    ctx.lineTo(x + 6, y + 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 1;
    [[y + 4], [y + 6]].forEach((yPosition) => {
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
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
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
    ctx.fillStyle = "#50C878";
    ctx.fillRect(x + 1, y + 3, 13, 4);
};
const drawStatusBar = () => {
    ctx.save();
    const statusBarGradient = ctx.createLinearGradient(
        0,
        0,
        0,
        STATUS_BAR_CONFIG.height,
    );
    statusBarGradient.addColorStop(0, "rgba(255, 255, 255, 0.1)");
    statusBarGradient.addColorStop(1, "rgba(255, 255, 255, 0.06)");
    ctx.fillStyle = statusBarGradient;
    ctx.fillRect(0, 0, 400, STATUS_BAR_CONFIG.height);
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 1;
    const currentTime = new Date();
    const bgColor = isConnected
        ? "rgba(100, 180, 255, 0.3)"
        : "rgba(128, 128, 128, 0.3)";
    const firstText = isConnected ? "Internet" : "Disabled";
    ctx.save();
    ctx.globalAlpha = 1 - internetTextFadeProgress;
    drawStatusBarPill(4, 76, bgColor, drawWiFiIcon, firstText);
    ctx.globalAlpha = internetTextFadeProgress;
    drawStatusBarPill(
        4,
        76,
        bgColor,
        drawWiFiIcon,
        isConnected ? "GolyBidoof" : "Disabled",
    );
    ctx.globalAlpha = 1;
    ctx.restore();
    const totalSeries = libraryApps.length;
    const totalVolumes = libraryApps.reduce(
        (sum, app) => sum + (app.volumes ? app.volumes.length : 1),
        0,
    );
    ctx.save();
    ctx.globalAlpha = 1 - statusBarFadeProgress;
    drawStatusBarPill(
        84,
        70,
        "rgba(255, 200, 100, 0.3)",
        drawBookIcon,
        `${totalSeries} Series`,
    );
    ctx.globalAlpha = statusBarFadeProgress;
    drawStatusBarPill(
        84,
        70,
        "rgba(255, 200, 100, 0.3)",
        drawVolumesIcon,
        `${totalVolumes} Vols`,
    );
    ctx.globalAlpha = 1;
    ctx.restore();
    if (totalPagesRead > 0) {
        const formattedPages = totalPagesRead.toLocaleString();
        drawStatusBarPill(
            158,
            56,
            "rgba(150, 255, 150, 0.3)",
            (x, y) => drawPageIcon(x, y - 1),
            formattedPages,
        );
    }
    const dateString = `${String(currentTime.getDate()).padStart(2, "0")}/${String(currentTime.getMonth() + 1).padStart(2, "0")}/${currentTime.getFullYear()}`;
    drawStatusBarPill(
        228,
        82,
        "rgba(255, 150, 150, 0.3)",
        (x, y) => drawCalendarIcon(x, y - 1),
        dateString,
    );
    const timeString = `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
    drawStatusBarPill(
        314,
        52,
        "rgba(200, 150, 255, 0.3)",
        (x, y) => drawClockIcon(x, y),
        timeString,
        "right",
    );
    drawStatusBarPill(
        370,
        24,
        "rgba(100, 255, 200, 0.3)",
        (x, y) => drawBatteryIcon(x, y - 1),
        "",
        "right",
    );
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
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fill();
    if (fillPercent > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(
            -outerRadius,
            -outerRadius,
            outerRadius * 2 * fillPercent,
            outerRadius * 2,
        );
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
        ctx.fillStyle = "#FFD700";
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
};
const drawStarRating = (x, y, rating, starSize = 6) => {
    const starSpacing = starSize * 2.5;
    for (let i = 0; i < 5; i++) {
        const starX = x + i * starSpacing;
        const fillAmount = Math.max(0, Math.min(1, rating - i));
        drawStar(starX, y, starSize, fillAmount);
    }
};
const drawBookShadow = (ctx, dimensions, scaleEffect, cosY) => {
    const shadowScale = 0.5 + scaleEffect * 0.5;
    const opacity = 0.3 * shadowScale * (0.5 + 0.5 * Math.abs(cosY));
    const width = Math.abs(dimensions.width * cosY);
    if (width > 1) {
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        ctx.fillRect(
            dimensions.x + 5 * shadowScale,
            dimensions.y + 5 * shadowScale,
            width,
            dimensions.height,
        );
    }
};
const drawBookPages = (ctx, dimensions, sinY, thickness) => {
    const projectedWidth = Math.abs(sinY) * thickness;
    const pagesX = dimensions.x - projectedWidth;
    const gradient = ctx.createLinearGradient(
        pagesX,
        dimensions.y,
        dimensions.x,
        dimensions.y,
    );
    gradient.addColorStop(0, "#eee");
    gradient.addColorStop(0.8, "#fff");
    gradient.addColorStop(1, "#ddd");
    ctx.fillStyle = gradient;
    ctx.fillRect(pagesX, dimensions.y, projectedWidth, dimensions.height);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 0.5;
    for (let i = 2; i < dimensions.height; i += 3) {
        ctx.beginPath();
        ctx.moveTo(pagesX, dimensions.y + i);
        ctx.lineTo(dimensions.x, dimensions.y + i);
        ctx.stroke();
    }
};
const drawBookSpine = (ctx, dimensions, image, transforms, thickness) => {
    const { centerX, centerY, cosY, sinY, cosX, sinZ, cosZ, scaleX, scaleY } =
        transforms;
    const halfW = dimensions.width / 2;
    const halfH = dimensions.height / 2;
    const frontRightX = centerX + halfW * cosY * cosZ * scaleX;
    const frontRightTopY =
        centerY + halfW * sinZ * scaleX + -halfH * cosX * scaleY;
    const frontRightBotY =
        centerY + halfW * sinZ * scaleX + halfH * cosX * scaleY;
    const spineScreenW = thickness * Math.abs(sinY) * scaleX;
    const backRightX = frontRightX + spineScreenW;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(frontRightX, frontRightTopY);
    ctx.lineTo(backRightX, frontRightTopY);
    ctx.lineTo(backRightX, frontRightBotY);
    ctx.lineTo(frontRightX, frontRightBotY);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    if (image) {
        ctx.drawImage(
            image,
            image.width * 0.98,
            0,
            image.width * 0.02,
            image.height,
            frontRightX,
            frontRightTopY,
            spineScreenW,
            frontRightBotY - frontRightTopY,
        );
    } else {
        ctx.fillStyle = "#333";
        ctx.fill();
    }
    const spineGrad = ctx.createLinearGradient(
        frontRightX,
        frontRightTopY,
        backRightX,
        frontRightTopY,
    );
    spineGrad.addColorStop(0, "rgba(0,0,0,0.4)");
    spineGrad.addColorStop(0.3, "rgba(255,255,255,0.1)");
    spineGrad.addColorStop(0.6, "rgba(0,0,0,0.1)");
    spineGrad.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = spineGrad;
    ctx.fill();
    ctx.restore();
    ctx.restore();
};
const drawBookCard = (appData) => {
    let currentImage = loadedImages[appData.id];
    let nextImage = null;
    if (appData.volumes && appData.volumes.length > 0) {
        const currentVolume =
            appData.volumes[currentVolumeIndex % appData.volumes.length];
        if (currentVolume?.imageId && loadedImages[currentVolume.imageId]) {
            currentImage = loadedImages[currentVolume.imageId];
        }
        if (nextVolumeIndex >= 0 && volumeCrossfadeProgress > 0) {
            const nextVolume =
                appData.volumes[nextVolumeIndex % appData.volumes.length];
            if (nextVolume?.imageId && loadedImages[nextVolume.imageId]) {
                nextImage = loadedImages[nextVolume.imageId];
            }
        }
    }
    ctx.save();
    let rotationY = 0,
        rotationX = 0,
        rotationZ = 0;
    let wobbleFloatEffect = Math.sin(wobbleAnimationTime * 1.5) * 0.3;
    let scaleEffect = 1.0;
    if (pageFlipDirection !== 0 && pageFlipProgress > 0) {
        const easedProgress =
            pageFlipProgress < 0.5
                ? 4 * pageFlipProgress * pageFlipProgress * pageFlipProgress
                : 1 - Math.pow(-2 * pageFlipProgress + 2, 3) / 2;
        rotationY = easedProgress * 2 * Math.PI * pageFlipDirection;
        const shrinkAmount = Math.sin(pageFlipProgress * Math.PI);
        const elasticBounce =
            Math.sin(pageFlipProgress * Math.PI * 3) * 0.02 * shrinkAmount;
        scaleEffect = 1.0 - shrinkAmount * 0.12 + elasticBounce;
        rotationX = Math.sin(pageFlipProgress * Math.PI * 2) * 0.05;
        wobbleFloatEffect = 0;
    } else {
        rotationY =
            (Math.sin(wobbleAnimationTime * 1.2) - 0.5) * 8 * (Math.PI / 180);
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
    drawBookShadow(ctx, BOOK_DIMENSIONS, scaleEffect, cosY);
    const showingBackCover =
        Math.abs(rotationY) > Math.PI / 2 &&
        Math.abs(rotationY) < (3 * Math.PI) / 2;
    const thickness = 15;
    const spineVisible = sinY > 0;
    const pagesVisible = sinY < 0;
    if (pagesVisible && Math.abs(sinY) > 0.05 && !showingBackCover) {
        drawBookPages(ctx, BOOK_DIMENSIONS, sinY, thickness);
    }
    if (showingBackCover) {
        const backCoverGradient = ctx.createLinearGradient(
            BOOK_DIMENSIONS.x,
            BOOK_DIMENSIONS.y,
            BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width,
            BOOK_DIMENSIONS.y,
        );
        backCoverGradient.addColorStop(0, "#e0e0e0");
        backCoverGradient.addColorStop(0.5, "#f5f5f5");
        backCoverGradient.addColorStop(1, "#d0d0d0");
        ctx.fillStyle = backCoverGradient;
        ctx.fillRect(
            BOOK_DIMENSIONS.x,
            BOOK_DIMENSIONS.y,
            BOOK_DIMENSIONS.width,
            BOOK_DIMENSIONS.height,
        );
        ctx.fillStyle = "rgba(0,0,0,0.03)";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.save();
        ctx.translate(
            BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width / 2,
            BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height / 2,
        );
        ctx.rotate(Math.PI / 4);
        ctx.fillText("NATIVELY", 0, 0);
        ctx.restore();
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;
        ctx.strokeRect(
            BOOK_DIMENSIONS.x,
            BOOK_DIMENSIONS.y,
            BOOK_DIMENSIONS.width,
            BOOK_DIMENSIONS.height,
        );
    } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(
            BOOK_DIMENSIONS.x,
            BOOK_DIMENSIONS.y,
            BOOK_DIMENSIONS.width,
            BOOK_DIMENSIONS.height,
        );
        if (currentImage) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(
                BOOK_DIMENSIONS.x,
                BOOK_DIMENSIONS.y,
                BOOK_DIMENSIONS.width,
                BOOK_DIMENSIONS.height,
            );
            ctx.clip();
            const imageScale = BOOK_DIMENSIONS.height / currentImage.height;
            const scaledImageWidth = currentImage.width * imageScale;
            const imageOffsetX =
                BOOK_DIMENSIONS.x + (BOOK_DIMENSIONS.width - scaledImageWidth) / 2;
            if (
                nextImage &&
                volumeCrossfadeProgress > 0 &&
                volumeCrossfadeProgress < 1
            ) {
                ctx.globalAlpha = 1 - volumeCrossfadeProgress;
                ctx.drawImage(
                    currentImage,
                    imageOffsetX,
                    BOOK_DIMENSIONS.y,
                    scaledImageWidth,
                    BOOK_DIMENSIONS.height,
                );
                const nextImageScale = BOOK_DIMENSIONS.height / nextImage.height;
                const nextScaledWidth = nextImage.width * nextImageScale;
                const nextImageOffsetX =
                    BOOK_DIMENSIONS.x + (BOOK_DIMENSIONS.width - nextScaledWidth) / 2;
                ctx.globalAlpha = volumeCrossfadeProgress;
                ctx.drawImage(
                    nextImage,
                    nextImageOffsetX,
                    BOOK_DIMENSIONS.y,
                    nextScaledWidth,
                    BOOK_DIMENSIONS.height,
                );
                ctx.globalAlpha = 1;
            } else {
                ctx.drawImage(
                    currentImage,
                    imageOffsetX,
                    BOOK_DIMENSIONS.y,
                    scaledImageWidth,
                    BOOK_DIMENSIONS.height,
                );
            }
            ctx.restore();
        } else {
            const grad = ctx.createLinearGradient(
                BOOK_DIMENSIONS.x,
                BOOK_DIMENSIONS.y,
                BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width,
                BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height,
            );
            grad.addColorStop(0, "#4facfe");
            grad.addColorStop(1, "#00f2fe");
            ctx.fillStyle = grad;
            ctx.fillRect(
                BOOK_DIMENSIONS.x,
                BOOK_DIMENSIONS.y,
                BOOK_DIMENSIONS.width,
                BOOK_DIMENSIONS.height,
            );
            ctx.fillStyle = "#fff";
            ctx.font = "bold 14px Verdana";
            ctx.textAlign = "center";
            const titleLines = wrapTextToLines(
                ctx,
                appData.name,
                BOOK_DIMENSIONS.width - 20,
                3,
            );
            titleLines.forEach((line, i) => {
                ctx.fillText(
                    line,
                    BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width / 2,
                    BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height / 3 + i * 18,
                );
            });
        }
        const glossGradient = ctx.createLinearGradient(
            BOOK_DIMENSIONS.x,
            BOOK_DIMENSIONS.y,
            BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width,
            BOOK_DIMENSIONS.y,
        );
        glossGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        glossGradient.addColorStop(0.2, "rgba(255, 255, 255, 0.1)");
        glossGradient.addColorStop(0.4, "rgba(255, 255, 255, 0)");
        glossGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = glossGradient;
        ctx.globalCompositeOperation = "overlay";
        ctx.fillRect(
            BOOK_DIMENSIONS.x,
            BOOK_DIMENSIONS.y,
            BOOK_DIMENSIONS.width,
            BOOK_DIMENSIONS.height,
        );
        ctx.globalCompositeOperation = "source-over";
        const spineShadow = ctx.createLinearGradient(
            BOOK_DIMENSIONS.x,
            BOOK_DIMENSIONS.y,
            BOOK_DIMENSIONS.x + 10,
            BOOK_DIMENSIONS.y,
        );
        spineShadow.addColorStop(0, "rgba(0,0,0,0.2)");
        spineShadow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = spineShadow;
        ctx.fillRect(
            BOOK_DIMENSIONS.x,
            BOOK_DIMENSIONS.y,
            10,
            BOOK_DIMENSIONS.height,
        );
        if (appData.volumes && appData.volumes.length > 1) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(
                BOOK_DIMENSIONS.x + 5,
                BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height - 25,
                70,
                20,
            );
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 10px Verdana, Geneva, sans-serif";
            ctx.textAlign = "center";
            const displayIndex =
                nextVolumeIndex >= 0 ? nextVolumeIndex : currentVolumeIndex;
            const displayVolume =
                appData.volumes[displayIndex % appData.volumes.length];
            const volumeNumber = displayVolume?.volumeNumber || displayIndex + 1;
            ctx.fillText(
                `Vol. ${volumeNumber} (${displayIndex + 1}/${appData.volumes.length})`,
                BOOK_DIMENSIONS.x + 40,
                BOOK_DIMENSIONS.y + BOOK_DIMENSIONS.height - 11,
            );
        }
    }
    ctx.restore();
    if (spineVisible && Math.abs(sinY) > 0.02) {
        drawBookSpine(
            ctx,
            BOOK_DIMENSIONS,
            currentImage,
            {
                centerX,
                centerY,
                cosY,
                sinY,
                cosX,
                sinZ,
                cosZ,
                scaleX: perspectiveScaleX,
                scaleY: perspectiveScaleY,
            },
            thickness,
        );
    }
    if (!showingBackCover) {
        drawRatingPanel(appData, 8, BOOK_DIMENSIONS.y);
        drawInfoPanel(
            appData,
            BOOK_DIMENSIONS.x + BOOK_DIMENSIONS.width + 18,
            BOOK_DIMENSIONS.y,
        );
    }
};
const drawRatingPanel = (appData, x, y) => {
    const panelWidth = 100;
    const panelHeight = 240 - y - 5;
    let contentHeight = 0;
    if (appData.level !== null) contentHeight += 42;
    let averageRating = appData.rating;
    if (appData.volumes && appData.volumes.length > 1) {
        const ratingTotals = { rating: 0 };
        const ratingCounts = { rating: 0 };
        appData.volumes.forEach((v) => {
            if (v.rating > 0) {
                ratingTotals.rating += v.rating;
                ratingCounts.rating++;
            }
        });
        if (ratingCounts.rating > 0)
            averageRating = ratingTotals.rating / ratingCounts.rating;
    }
    if (averageRating > 0) contentHeight += 44;
    if (appData.globalRating > 0) contentHeight += 30;
    let averageEntertainmentRating = appData.entertainmentRating;
    let averageLanguageRating = appData.languageLearningRating;
    if (appData.volumes && appData.volumes.length > 1) {
        const ratingTotals = { entertainment: 0, language: 0 };
        const ratingCounts = { entertainment: 0, language: 0 };
        appData.volumes.forEach((v) => {
            if (v.entertainmentRating) {
                ratingTotals.entertainment += v.entertainmentRating;
                ratingCounts.entertainment++;
            }
            if (v.languageLearningRating) {
                ratingTotals.language += v.languageLearningRating;
                ratingCounts.language++;
            }
        });
        if (ratingCounts.entertainment > 0)
            averageEntertainmentRating =
                ratingTotals.entertainment / ratingCounts.entertainment;
        if (ratingCounts.language > 0)
            averageLanguageRating = ratingTotals.language / ratingCounts.language;
    }
    if (averageEntertainmentRating || averageLanguageRating) {
        const widgetHeight =
            averageEntertainmentRating && averageLanguageRating ? 54 : 30;
        contentHeight += widgetHeight + 6;
    }
    if (appData.volumes && appData.volumes.length > 1) contentHeight += 38;
    if (appData.volumes && appData.volumes.length > 1) {
        let totalSeriesPages = 0;
        appData.volumes.forEach((volume) => {
            if (volume.pageCount) totalSeriesPages += volume.pageCount;
        });
        if (totalSeriesPages > 0) contentHeight += 28;
    }
    const maxScroll = Math.max(0, contentHeight - panelHeight + 10);
    if (maxScroll > 0) {
        const deltaTime = 1 / 60;
        const waitTime = 2.0;
        const scrollSpeed = 20;
        if (ratingPanelScrollWaitTimer > 0) {
            ratingPanelScrollWaitTimer -= deltaTime;
        } else {
            ratingPanelScrollOffset +=
                scrollSpeed * deltaTime * ratingPanelScrollDirection;
            if (
                ratingPanelScrollDirection === 1 &&
                ratingPanelScrollOffset >= maxScroll
            ) {
                ratingPanelScrollOffset = maxScroll;
                ratingPanelScrollDirection = -1;
                ratingPanelScrollWaitTimer = waitTime;
            } else if (
                ratingPanelScrollDirection === -1 &&
                ratingPanelScrollOffset <= 0
            ) {
                ratingPanelScrollOffset = 0;
                ratingPanelScrollDirection = 1;
                ratingPanelScrollWaitTimer = waitTime;
            }
        }
    } else {
        ratingPanelScrollOffset = 0;
    }
    ctx.save();
    if (pageFlipDirection !== 0 && pageFlipProgress > 0 && pageFlipProgress < 1) {
        ctx.globalAlpha = calculateFadeAlpha(pageFlipProgress);
    }
    ctx.beginPath();
    ctx.rect(x, y, panelWidth, panelHeight);
    ctx.clip();
    ctx.translate(0, -ratingPanelScrollOffset);
    ctx.textAlign = "center";
    const centerX = x + panelWidth / 2;
    let currentY = y;
    if (appData.level !== null) {
        const levelColorMap = {
            13: "rgb(248, 100, 100)",
            20: "rgb(111, 66, 193)",
            27: "rgb(253, 126, 20)",
            34: "rgb(92, 184, 92)",
            0: "rgb(100, 150, 220)",
            41: "rgb(255, 215, 0)",
        };
        const levelColor = Object.keys(levelColorMap)
            .reverse()
            .find((key) => appData.level >= parseInt(key))
            ? levelColorMap[
            Object.keys(levelColorMap)
                .reverse()
                .find((key) => appData.level >= parseInt(key))
            ]
            : levelColorMap[0];
        drawRoundedRect(ctx, {
            x: x + 10,
            y: currentY,
            width: panelWidth - 20,
            height: 36,
            radius: 8,
            fill: levelColor,
        });
        drawText(ctx, {
            text: "LEVEL",
            x: centerX,
            y: currentY + 12,
            font: "8px Verdana, Geneva, sans-serif",
            color: "#ffffff",
            align: "center",
        });
        drawText(ctx, {
            text: appData.level.toString(),
            x: centerX,
            y: currentY + 30,
            font: "bold 18px Verdana, Geneva, sans-serif",
            color: "#ffffff",
            align: "center",
        });
        currentY += 42;
    }
    if (averageRating > 0) {
        drawGlassPanel(ctx, {
            x: x + 10,
            y: currentY,
            width: panelWidth - 20,
            height: 38,
            radius: 6,
            stroke: "#20c997",
        });
        drawText(ctx, {
            text: "RATING",
            x: centerX,
            y: currentY + 9,
            font: "bold 7px Verdana, Geneva, sans-serif",
            align: "center",
        });
        const starSize = 6;
        const starSpacing = starSize * 2.5;
        const totalStarWidth = 4 * starSpacing + 2 * starSize - 12;
        drawStarRating(
            centerX - totalStarWidth / 2,
            currentY + 22,
            averageRating,
            starSize,
        );
        currentY += 44;
    }
    if (appData.globalRating > 0) {
        drawGlassPanel(ctx, {
            x: x + 10,
            y: currentY,
            width: panelWidth - 20,
            height: 24,
            radius: 6,
            fill: "rgba(255, 255, 255, 0.05)",
            stroke: "rgba(255, 255, 255, 0.1)",
        });
        const ratingText = `${appData.globalRating.toFixed(2)} (${appData.globalRatingCount})`;
        drawText(ctx, {
            text: "GLOBAL",
            x: centerX,
            y: currentY + 7,
            font: "bold 6px Verdana, Geneva, sans-serif",
            align: "center",
            color: "rgba(255, 255, 255, 0.6)",
        });
        drawText(ctx, {
            text: ratingText,
            x: centerX,
            y: currentY + 18,
            font: "bold 9px Verdana, Geneva, sans-serif",
            align: "center",
        });
        currentY += 30;
    }
    if (averageEntertainmentRating || averageLanguageRating) {
        const widgetHeight =
            averageEntertainmentRating && averageLanguageRating ? 54 : 30;
        drawGlassPanel(ctx, {
            x: x + 10,
            y: currentY,
            width: panelWidth - 20,
            height: widgetHeight,
            radius: 6,
        });
        let innerY = currentY + 4;
        if (averageEntertainmentRating) {
            drawText(ctx, {
                text: "ENTERTAINMENT",
                x: centerX,
                y: innerY + 5,
                font: "bold 7px Verdana, Geneva, sans-serif",
                align: "center",
            });
            const starSize = 5;
            const starSpacing = starSize * 2.5;
            const totalStarWidth = 4 * starSpacing + 2 * starSize - 12;
            drawStarRating(
                centerX - totalStarWidth / 2,
                innerY + 16,
                averageEntertainmentRating,
                starSize,
            );
            innerY += 26;
        }
        if (averageLanguageRating) {
            drawText(ctx, {
                text: "LANG. LEARNING",
                x: centerX,
                y: innerY + 5,
                font: "bold 7px Verdana, Geneva, sans-serif",
                align: "center",
            });
            const starSize = 5;
            const starSpacing = starSize * 2.5;
            const totalStarWidth = 4 * starSpacing + 2 * starSize - 12;
            drawStarRating(
                centerX - totalStarWidth / 2,
                innerY + 16,
                averageLanguageRating,
                starSize,
            );
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
            fill: "rgba(255, 255, 255, 0.08)",
            stroke: "rgba(255, 255, 255, 0.2)",
        });
        drawText(ctx, {
            text: `${appData.volumes.length} Volumes`,
            x: centerX,
            y: currentY + 20,
            font: "bold 11px Verdana, Geneva, sans-serif",
            align: "center",
        });
        currentY += 38;
    }
    if (appData.volumes && appData.volumes.length > 1) {
        let totalSeriesPages = 0;
        appData.volumes.forEach((volume) => {
            if (volume.pageCount) totalSeriesPages += volume.pageCount;
        });
        if (totalSeriesPages > 0) {
            drawGlassPanel(ctx, {
                x: x + 10,
                y: currentY,
                width: panelWidth - 20,
                height: 28,
                radius: 6,
                fill: "rgba(255, 255, 255, 0.05)",
                stroke: "rgba(255, 255, 255, 0.15)",
            });
            drawText(ctx, {
                text: `${totalSeriesPages.toLocaleString()} pages`,
                x: centerX,
                y: currentY + 17,
                font: "bold 9px Verdana, Geneva, sans-serif",
                align: "center",
            });
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
        fill: "rgba(0, 0, 0, 0.18)",
        stroke: "rgba(255, 255, 255, 0.12)",
    });
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 2;
    let displayTitle = appData.name;
    if (
        appData.volumes &&
        appData.volumes.length === 1 &&
        appData.volumes[0].volumeNumber
    ) {
        displayTitle = `${appData.name} ${appData.volumes[0].volumeNumber}`;
    }
    const titleLines = wrapTextToLines(ctx, displayTitle, panelWidth - 8, 3);
    titleLines.forEach((line) => {
        drawText(ctx, {
            text: line,
            x: x + 10,
            y: currentY,
            font: "bold 10px Verdana, Geneva, sans-serif",
        });
        currentY += textLineHeight + 2;
    });
    currentY += 3;
    if (appData.author) {
        drawText(ctx, {
            text: truncateTextWithEllipsis(ctx, appData.author, panelWidth - 14),
            x: x + 10,
            y: currentY,
            font: "7px Verdana, Geneva, sans-serif",
            color: "rgba(255, 255, 255, 0.8)",
        });
        currentY += textLineHeight;
    }
    currentY += 5;
    const statusColorMap = {
        Reading: "#4A90E2",
        Finished: "#50C878",
        "Wish list": "#F39C12",
        Stopped: "#E74C3C",
    };
    ctx.fillStyle = statusColorMap[appData.status] || "#999";
    ctx.beginPath();
    ctx.arc(x + 10, currentY - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, {
        text: appData.status,
        x: x + 20,
        y: currentY,
        font: "bold 8px Verdana, Geneva, sans-serif",
    });
    if (
        appData.dateFinished &&
        (!appData.volumes || appData.volumes.length <= 1)
    ) {
        let formattedDate = appData.dateFinished;
        try {
            const date = new Date(appData.dateFinished);
            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = date.getFullYear();
            formattedDate = `${day}/${month}/${year}`;
        } catch (error) {
            formattedDate = "Invalid date";
        }
        drawText(ctx, {
            text: formattedDate,
            x: x + 20,
            y: currentY + textLineHeight,
            font: "7px Verdana, Geneva, sans-serif",
            color: "rgba(255, 255, 255, 0.7)",
        });
        currentY += textLineHeight * 2 + 2;
    } else {
        currentY += textLineHeight + 2;
    }
    let mediaInfoText = "";
    if (appData.mediaType) mediaInfoText += appData.mediaType;

    let displayPageCount = appData.pageCount;
    if (appData.volumes && appData.volumes.length > 0) {
        const displayIndex = nextVolumeIndex >= 0 ? nextVolumeIndex : currentVolumeIndex;
        const currentVolume = appData.volumes[displayIndex % appData.volumes.length];
        if (currentVolume && currentVolume.pageCount) {
            displayPageCount = currentVolume.pageCount;
        }
    }

    if (displayPageCount) {
        if (mediaInfoText) mediaInfoText += " | ";
        mediaInfoText += `${displayPageCount}p`;
    }
    drawText(ctx, {
        text: mediaInfoText,
        x: x + 10,
        y: currentY,
        font: "7px Verdana, Geneva, sans-serif",
        color: "rgba(255, 255, 255, 0.9)",
    });
    currentY += textLineHeight + 2;
    if (appData.genres && appData.genres.length > 0) {
        const label = "Genres: ";
        const availableWidth = panelWidth - 20;
        ctx.font = "7px Verdana, Geneva, sans-serif";
        const chunks = [];
        let currentChunk = [];
        let currentText = label;
        appData.genres.forEach((genre) => {
            const separator = currentChunk.length > 0 ? ", " : "";
            const nextText = currentText + separator + genre;
            const width = ctx.measureText(nextText).width;
            if (width < availableWidth) {
                currentChunk.push(genre);
                currentText = nextText;
            } else {
                if (currentChunk.length > 0) chunks.push(currentChunk);
                currentChunk = [genre];
                currentText = label + genre;
            }
        });
        if (currentChunk.length > 0) chunks.push(currentChunk);
        if (chunks.length === 1) {
            drawText(ctx, {
                text: label + chunks[0].join(", "),
                x: x + 10,
                y: currentY,
                font: "7px Verdana, Geneva, sans-serif",
                color: "rgba(255, 255, 255, 0.7)",
            });
        } else {
            const cycleDuration = ANIMATION_TIMING.statusCycle;
            const fadeDuration = ANIMATION_TIMING.statusFade;
            const now = Date.now() / 1000;
            const totalIndex = Math.floor(now / cycleDuration);
            const timeInCycle = now % cycleDuration;
            const currentIndex = totalIndex % chunks.length;
            const prevIndex = (totalIndex - 1 + chunks.length) % chunks.length;
            const fadeProgress =
                timeInCycle < fadeDuration ? timeInCycle / fadeDuration : 1;
            const baseAlpha = ctx.globalAlpha;
            ctx.save();
            if (fadeProgress < 1) {
                ctx.globalAlpha = baseAlpha * (1 - fadeProgress);
                drawText(ctx, {
                    text: label + chunks[prevIndex].join(", "),
                    x: x + 10,
                    y: currentY,
                    font: "7px Verdana, Geneva, sans-serif",
                    color: "rgba(255, 255, 255, 0.7)",
                });
                ctx.globalAlpha = baseAlpha * fadeProgress;
                drawText(ctx, {
                    text: label + chunks[currentIndex].join(", "),
                    x: x + 10,
                    y: currentY,
                    font: "7px Verdana, Geneva, sans-serif",
                    color: "rgba(255, 255, 255, 0.7)",
                });
            } else {
                drawText(ctx, {
                    text: label + chunks[currentIndex].join(", "),
                    x: x + 10,
                    y: currentY,
                    font: "7px Verdana, Geneva, sans-serif",
                    color: "rgba(255, 255, 255, 0.7)",
                });
            }
            ctx.restore();
        }
        currentY += textLineHeight;
    }
    ctx.shadowBlur = 0;
    if (appData.volumes && appData.volumes.length > 1) {
        currentY += 2;
        const remainingHeight = y + BOOK_DIMENSIONS.height - currentY;
        const listAreaHeight = Math.max(0, remainingHeight - 20);
        drawVolumeList(
            appData.volumes,
            x + 8,
            currentY,
            panelWidth - 16,
            Math.max(10, listAreaHeight - 12),
        );
    }
    ctx.restore();
};
const drawVolumeList = (volumes, x, y, width, maxVisibleHeight = 100) => {
    const volumeLineHeight = 13;
    const totalContentHeight = volumes.length * volumeLineHeight;
    const formatCompactDate = (dateString) => {
        if (!dateString) return "";
        try {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (error) {
            return "Invalid date";
        }
    };
    ctx.save();
    drawRoundedRect(ctx, {
        x: x - 2,
        y,
        width: width + 4,
        height: 18,
        radius: 6,
        fill: "rgba(255, 255, 255, 0.1)",
        stroke: "rgba(255, 255, 255, 0.15)",
    });
    drawText(ctx, {
        text: "VOLUMES",
        x: x + 2,
        y: y + 12,
        font: "bold 8px Verdana, Geneva, sans-serif",
    });
    const listStartY = y + 20;
    ctx.beginPath();
    ctx.rect(x - 2, listStartY, width + 4, maxVisibleHeight);
    ctx.clip();
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(x - 2, listStartY, width + 4, maxVisibleHeight);
    const maximumScroll = Math.max(0, totalContentHeight - maxVisibleHeight);
    volumeListScrollPosition = Math.max(
        0,
        Math.min(volumeListScrollPosition, maximumScroll),
    );
    let currentY = listStartY + 12 - volumeListScrollPosition;
    const activeVolumeIndex =
        nextVolumeIndex >= 0 ? nextVolumeIndex : currentVolumeIndex;
    volumes.forEach((volume, volumeIndex) => {
        if (
            currentY > listStartY - volumeLineHeight &&
            currentY < listStartY + maxVisibleHeight + volumeLineHeight
        ) {
            if (volumeIndex === activeVolumeIndex) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
                ctx.fillRect(x - 2, currentY - 9, width + 4, volumeLineHeight);
            }
            const volumeId = volume.volumeNumber
                ? `Vol. ${volume.volumeNumber}`
                : `Vol. ${volumeIndex + 1}`;
            drawText(ctx, {
                text: volumeId,
                x: x + 2,
                y: currentY,
                font: "bold 8px Verdana, Geneva, sans-serif",
                color:
                    volumeIndex === activeVolumeIndex
                        ? "#FFD700"
                        : "rgba(255, 255, 255, 0.9)",
            });
            const rightSideText = volume.dateFinished
                ? formatCompactDate(volume.dateFinished)
                : volume.status || "";
            if (rightSideText) {
                drawText(ctx, {
                    text: rightSideText,
                    x: x + width - 4,
                    y: currentY,
                    font: "7px Verdana, Geneva, sans-serif",
                    color: "rgba(255, 255, 255, 0.6)",
                    align: "right",
                });
            }
        }
        currentY += volumeLineHeight;
    });
    ctx.restore();
    if (totalContentHeight > maxVisibleHeight) {
        const scrollbarHeight = Math.max(
            20,
            (maxVisibleHeight / totalContentHeight) * maxVisibleHeight,
        );
        const scrollbarY =
            listStartY +
            (volumeListScrollPosition / maximumScroll) *
            (maxVisibleHeight - scrollbarHeight);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(x + width + 1, scrollbarY, 2, scrollbarHeight);
    }
};
const drawPageIndicator = () => {
    const centerX = 200;
    const indicatorY = 224;
    if (totalPageCount > 0) {
        ctx.save();
        ctx.font = "bold 9px Verdana, Geneva, sans-serif";
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
            fill: "rgba(255, 255, 255, 0.15)",
            stroke: "rgba(255, 255, 255, 0.25)",
        });
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 1;
        drawText(ctx, {
            text: pageText,
            x: centerX,
            y: indicatorY + 10,
            font: "bold 9px Verdana, Geneva, sans-serif",
            align: "center",
        });
        ctx.shadowBlur = 0;
        const sortLabel = SORT_METHODS[currentSortIndex].label;
        const dirArrow = sortDirection === 1 ? "▲" : "▼";
        const sortText = `${sortLabel} ${dirArrow}`;
        drawText(ctx, {
            text: sortText,
            x: centerX + pillWidth / 2 + 10,
            y: indicatorY + 10,
            font: "9px Verdana, Geneva, sans-serif",
            color: "rgba(255,255,255,0.7)",
            align: "left",
        });
        drawText(ctx, {
            text: "[Z/X] Sort  [C] Dir",
            x: 395,
            y: indicatorY + 10,
            font: "9px Verdana, Geneva, sans-serif",
            color: "rgba(255,255,255,0.4)",
            align: "right",
        });
        ctx.restore();
    }
};
const API_BASE =
    window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.protocol === "file:"
        ? "http://localhost:3000"
        : "https://scintillating-charisma-production.up.railway.app";
const fetchReadingStats = async () => {
    try {
        const response = await fetch(`${API_BASE}/api/proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                endpoint: "stats",
                body: { year: new Date().getFullYear() },
            }),
        });
        if (response.ok) {
            const data = await response.json();
            if (data.totalPagesRead !== undefined)
                totalPagesRead = data.totalPagesRead;
            usingFallback = false;
            isConnected = true;
        }
    } catch (e) {
        const fb = await fetch(`${API_BASE}/stats.json`);
        const data = await fb.json();
        totalPagesRead = data.totalPagesRead || 0;
        usingFallback = true;
        isConnected = false;
    }
};
const processLibraryResults = async (results) => {
    if (!results || results.length === 0) return;
    const rawApps = results.map((result) => ({
        name: result.item?.title || "Unknown",
        seriesTitle: result.item?.seriesTitle || "",
        imageUrl: result.item?.image?.url || null,
        level: result.ratingLevel || result.item?.rating?.lvl || null,
        status: result.statusDisplay || "Unknown",
        dateStarted: result.dateStartedData?.display || null,
        dateFinished: result.dateFinishedData?.display || null,
        dateFinishedTimestamp: result.dateFinishedData?.timestampDate || 0,
        pageCount: result.item?.pageCount || null,
        author: result.item?.author || null,
        mediaType: result.item?.mediaTypeDisplay || null,
        genres: result.item?.genres || [],
        globalRating: result.item?.reviewData?.avg_rating || 0,
        globalRatingCount: result.item?.reviewData?.rating_count || 0,
        rating: result.review?.rating || null,
        entertainmentRating: result.review?.entertainmentRating || null,
        languageLearningRating: result.review?.languageLearningRating || null,
        id: result.item?.id || Math.random(),
    }));
    const seriesMap = {};
    const normalizeText = (text) => {
        return text.replace(/[\uff10-\uff19]/g, (m) =>
            String.fromCharCode(m.charCodeAt(0) - 0xfee0),
        );
    };
    rawApps.forEach((app) => {
        let seriesName = app.seriesTitle;
        let volumeNumber = null;
        const normalizedName = normalizeText(app.name);
        const volumeRegex =
            /(?:Vol\.?|Volume|巻|#)?\s*[:\s(\uff08]?\s*(\d+)\s*[)\uff09]?\s*$/i;
        const match = normalizedName.match(volumeRegex);
        if (match) {
            volumeNumber = parseInt(match[1]);
            if (!seriesName) {
                seriesName = normalizedName.replace(volumeRegex, "").trim();
                seriesName = seriesName.replace(/[:\-\s]+$/, "");
            }
        }
        if (!seriesName) {
            seriesName = app.name.trim();
        }
        if (!seriesMap[seriesName]) {
            seriesMap[seriesName] = {
                ...app,
                name: seriesName,
                volumes: [],
                volumeImages: [],
            };
        }
        if (volumeNumber === null) {
            volumeNumber = -1;
        }
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
            imageUrl: app.imageUrl,
        });
        seriesMap[seriesName].volumeImages.push({
            id: app.id,
            url: app.imageUrl,
        });
        if (
            app.dateFinishedTimestamp > seriesMap[seriesName].dateFinishedTimestamp
        ) {
            seriesMap[seriesName].dateFinishedTimestamp = app.dateFinishedTimestamp;
            seriesMap[seriesName].dateFinished = app.dateFinished;
        }
    });
    libraryApps = Object.values(seriesMap);
    libraryApps.forEach((app) => {
        if (app.volumes.length === 1 && app.volumes[0].volumeNumber === -1) {
            app.volumes[0].volumeNumber = null;
        } else {
            app.volumes.forEach((vol, idx) => {
                if (vol.volumeNumber === -1) {
                    vol.volumeNumber = idx + 1;
                }
            });
        }
        if (app.volumes && app.volumes.length > 1) {
            app.volumes.sort((a, b) => {
                if (a.volumeNumber !== b.volumeNumber) {
                    return a.volumeNumber - b.volumeNumber;
                }
                return b.dateFinishedTimestamp - a.dateFinishedTimestamp;
            });
        }
    });
    sortLibrary();
    totalPageCount = libraryApps.length;
    currentPageIndex = 0;
    preloadImagesForPage(0);
    resetRatingPanelScroll();
};
const SORT_COMPARATORS = {
    recent: (a, b) =>
        (a.dateFinishedTimestamp || 0) - (b.dateFinishedTimestamp || 0),
    volumesRead: (a, b) => (a.volumes?.length || 1) - (b.volumes?.length || 1),
    level: (a, b) => (a.level || 0) - (b.level || 0),
    pagesRead: (a, b) => {
        const getPages = (item) =>
            item.volumes
                ? item.volumes.reduce((s, v) => s + (v.pageCount || 0), 0)
                : item.pageCount || 0;
        return getPages(a) - getPages(b);
    },
    chronological: (a, b) =>
        (a.dateFinishedTimestamp || 0) - (b.dateFinishedTimestamp || 0),
    rating: (a, b) => (a.rating || 0) - (b.rating || 0),
    globalRating: (a, b) => (a.globalRating || 0) - (b.globalRating || 0),
    popularity: (a, b) => (a.globalRatingCount || 0) - (b.globalRatingCount || 0),
};
const sortLibrary = () => {
    const method = SORT_METHODS[currentSortIndex].id;
    const comparator = SORT_COMPARATORS[method] || SORT_COMPARATORS.recent;
    libraryApps.sort((a, b) => comparator(a, b) * sortDirection);
};
const fetchLibraryData = async () => {
    try {
        const response = await fetch(`${API_BASE}/api/proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                endpoint: "library",
                body: {
                    page: 1,
                    numOfPages: 1,
                    totalCount: 0,
                    libraryType: "books",
                    sort: "-recent",
                    pageSize: 50,
                },
            }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            await processLibraryResults(data.results);
        }
        isLoading = false;
        usingFallback = false;
        isConnected = true;
    } catch (e) {
        const fb = await fetch(`${API_BASE}/library.json`);
        const data = await fb.json();
        if (data.results && data.results.length > 0) {
            await processLibraryResults(data.results);
        }
        isLoading = false;
        usingFallback = true;
        isConnected = false;
    }
};
const preloadImages = async () => {
    const imageLoadPromises = [];
    libraryApps.forEach((app) => {
        if (app.imageUrl) {
            imageLoadPromises.push(
                new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        loadedImages[app.id] = img;
                        resolve();
                    };
                    img.onerror = () =>
                        reject(new Error(`Failed to load image for ${app.name}`));
                    img.src = app.imageUrl;
                }),
            );
        }
        if (app.volumeImages && app.volumeImages.length > 0) {
            app.volumeImages.forEach((volumeImage) => {
                if (volumeImage.url) {
                    imageLoadPromises.push(
                        new Promise((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => {
                                loadedImages[volumeImage.id] = img;
                                resolve();
                            };
                            img.onerror = () =>
                                reject(new Error(`Failed to load volume image`));
                            img.src = volumeImage.url;
                        }),
                    );
                }
            });
        }
    });
    await Promise.all(imageLoadPromises);
};
const preloadImagesForPage = async (pageIndex) => {
    const app = libraryApps[pageIndex];
    if (!app) return;
    const imagesToLoad = [];
    if (app.imageUrl && !loadedImages[app.id]) {
        imagesToLoad.push({ id: app.id, url: app.imageUrl });
    }
    if (app.volumes && app.volumes.length > 0) {
        app.volumes.forEach((volume) => {
            if (volume.imageUrl && !loadedImages[volume.imageId]) {
                imagesToLoad.push({ id: volume.imageId, url: volume.imageUrl });
            }
        });
    }
    const imageLoadPromises = imagesToLoad.map(
        (imgData) =>
            new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    loadedImages[imgData.id] = img;
                    resolve();
                };
                img.onerror = () =>
                    reject(new Error(`Failed to load image for ${imgData.id}`));
                img.src = imgData.url;
            }),
    );
    await Promise.all(imageLoadPromises);
};
const drawHomeMenu = () => {
    const currentFrameTime = performance.now() / 1000;
    const deltaTime =
        previousFrameTime === 0
            ? 0.016
            : Math.min(currentFrameTime - previousFrameTime, 0.1);
    previousFrameTime = currentFrameTime;
    ctx.clearRect(0, 0, 400, 240);
    drawBackground();
    if (isLoading) {
        ctx.fillStyle = COLORS.text;
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 2;
        ctx.fillText("Loading library...", 200, 120);
        ctx.shadowBlur = 0;
        drawPageIndicator();
        drawStatusBar();
        return;
    }
    introAnimationProgress = Math.min(
        1,
        introAnimationProgress + deltaTime * 2.0,
    );
    const scaleX = easeOutBack(introAnimationProgress);
    const slideY = (1 - easeOutBack(introAnimationProgress)) * 20;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 20, 400, 220);
    ctx.clip();
    ctx.translate(200, 130);
    ctx.scale(scaleX, 1);
    ctx.translate(-200, -130 + slideY);
    ctx.globalAlpha = Math.min(1, introAnimationProgress * 1.5);
    if (hasError) {
        ctx.fillStyle = "#FF6B6B";
        ctx.font = "bold 14px Verdana, Geneva, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ERROR", 200, 100);
        ctx.fillStyle = COLORS.text;
        ctx.font = "10px Verdana, Geneva, sans-serif";
        ctx.fillText(errorMessage, 200, 130);
    } else if (libraryApps.length > 0 && currentPageIndex < libraryApps.length) {
        drawBookCard(libraryApps[currentPageIndex]);
    }
    drawPageIndicator();
    ctx.restore();
    drawStatusBar();
    if (hasError) return;
    wobbleAnimationTime += deltaTime;
    internetTextTimer += deltaTime;
    if (internetTextTimer < ANIMATION_TIMING.statusCycle) {
        internetTextFadeProgress = Math.max(
            0,
            internetTextFadeProgress - deltaTime * (1 / ANIMATION_TIMING.statusFade),
        );
    } else if (internetTextTimer < ANIMATION_TIMING.statusCycle * 2) {
        const fadeTime = internetTextTimer - ANIMATION_TIMING.statusCycle;
        internetTextFadeProgress =
            fadeTime < ANIMATION_TIMING.statusFade
                ? fadeTime / ANIMATION_TIMING.statusFade
                : 1;
    } else {
        internetTextTimer = 0;
    }
    statusBarCycleTimer += deltaTime;
    if (statusBarCycleTimer < ANIMATION_TIMING.statusCycle) {
        statusBarFadeProgress = Math.max(
            0,
            statusBarFadeProgress - deltaTime * (1 / ANIMATION_TIMING.statusFade),
        );
    } else if (statusBarCycleTimer < ANIMATION_TIMING.statusCycle * 2) {
        const fadeTime = statusBarCycleTimer - ANIMATION_TIMING.statusCycle;
        statusBarFadeProgress =
            fadeTime < ANIMATION_TIMING.statusFade
                ? fadeTime / ANIMATION_TIMING.statusFade
                : 1;
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
            preloadImagesForPage(currentPageIndex);
        }
        if (pageFlipProgress >= 1) {
            pageFlipProgress = 0;
            pageFlipDirection = 0;
        }
    } else {
        const currentApp = libraryApps[currentPageIndex];
        if (currentApp?.volumes && currentApp.volumes.length > 1) {
            volumeDisplayTimer += deltaTime;
            const waitTime =
                currentVolumeIndex === 0
                    ? ANIMATION_TIMING.volumeFirstDelay
                    : ANIMATION_TIMING.volumeDisplay;
            if (volumeDisplayTimer < waitTime) {
                nextVolumeIndex = -1;
                volumeCrossfadeProgress = 0;
            } else if (
                volumeDisplayTimer >= waitTime &&
                volumeDisplayTimer < waitTime + ANIMATION_TIMING.volumeFade
            ) {
                if (nextVolumeIndex < 0) {
                    nextVolumeIndex =
                        (currentVolumeIndex + 1) % currentApp.volumes.length;
                }
                volumeCrossfadeProgress =
                    (volumeDisplayTimer - waitTime) / ANIMATION_TIMING.volumeFade;
            } else {
                if (nextVolumeIndex < 0) {
                    nextVolumeIndex =
                        (currentVolumeIndex + 1) % currentApp.volumes.length;
                }
                currentVolumeIndex = nextVolumeIndex;
                nextVolumeIndex = -1;
                volumeCrossfadeProgress = 0;
                volumeDisplayTimer = 0;
            }
        }
    }
};
const resetRatingPanelScroll = () => {
    ratingPanelScrollOffset = 0;
    ratingPanelScrollDirection = 1;
    ratingPanelScrollWaitTimer = 2.0;
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
        resetRatingPanelScroll();
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
        resetRatingPanelScroll();
    }
};
const handleVolumeNavigation = (direction) => {
    const currentApp = libraryApps[currentPageIndex];
    if (currentApp?.volumes && currentApp.volumes.length > 1) {
        if (nextVolumeIndex >= 0) currentVolumeIndex = nextVolumeIndex;
        nextVolumeIndex =
            (currentVolumeIndex + direction + currentApp.volumes.length) %
            currentApp.volumes.length;
        volumeDisplayTimer =
            currentVolumeIndex === 0
                ? ANIMATION_TIMING.volumeFirstDelay
                : ANIMATION_TIMING.volumeDisplay;
        volumeCrossfadeProgress = 0;
        const volumeLineHeight = 13;
        const listHeight = 100;
        const targetY = nextVolumeIndex * volumeLineHeight;
        if (targetY < volumeListScrollPosition) {
            volumeListScrollPosition = targetY;
        } else if (
            targetY >
            volumeListScrollPosition + listHeight - volumeLineHeight
        ) {
            volumeListScrollPosition = targetY - listHeight + volumeLineHeight;
        }
    } else {
        if (direction < 0)
            volumeListScrollPosition = Math.max(0, volumeListScrollPosition - 26);
        else volumeListScrollPosition = 0;
    }
};
const cycleSort = (direction) => {
    currentSortIndex =
        (currentSortIndex + direction + SORT_METHODS.length) % SORT_METHODS.length;
    sortLibrary();
    currentPageIndex = 0;
    targetPageIndex = -1;
    preloadImagesForPage(0);
    resetRatingPanelScroll();
};
document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    switch (key) {
        case "arrowright":
        case "l":
            navigateToNextPage();
            break;
        case "arrowleft":
        case "h":
            navigateToPreviousPage();
            break;
        case "arrowup":
        case "k":
            handleVolumeNavigation(-1);
            break;
        case "arrowdown":
        case "j":
            handleVolumeNavigation(1);
            break;
        case "z":
            cycleSort(-1);
            break;
        case "x":
            cycleSort(1);
            break;
        case "c":
            sortDirection *= -1;
            cycleSort(0);
            break;
    }
});
canvas.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        volumeListScrollPosition += e.deltaY * 0.5;
    },
    { passive: false },
);
canvas.addEventListener("click", (e) => {
    const canvasBounds = canvas.getBoundingClientRect();
    const clickX = (e.clientX - canvasBounds.left) * (400 / canvasBounds.width);
    clickX > 200 ? navigateToNextPage() : navigateToPreviousPage();
});
let lastFrameTime = 0;
const FPS_LIMIT = 30;
const FRAME_INTERVAL = 1000 / FPS_LIMIT;

const startAnimationLoop = (timestamp) => {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = timestamp - lastFrameTime;

    if (elapsed > FRAME_INTERVAL) {
        drawHomeMenu();
        lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);
    }

    requestAnimationFrame(startAnimationLoop);
};
requestAnimationFrame(startAnimationLoop);
Promise.all([fetchLibraryData(), fetchReadingStats()]);
