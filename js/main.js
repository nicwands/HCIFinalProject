// Global vars
const videoEl = document.getElementById('inputVideo')
const accessContainer = document.getElementById('accessContainer')
const animationContainer = document.getElementById('animationContainer')
const camContainer = document.getElementById('camContainer')
const colorBox = document.getElementById('colorBox')
const emotionHeader = document.getElementById('emotionHeader')
const spotifyPlayer = document.getElementById('spotifyPlayer')
const playerShadow = document.getElementById('shadow')

// Emotion images
const cloudImg = document.getElementById('cloudImg')
const devilImg = document.getElementById('devilImg')
const haloImg = document.getElementById('haloImg')
const exclamationImg = document.getElementById('exclamationImg')

let animationStarted = false
let curExpressionRead = 'neutral'
let curExpressionLoaded = 'neutral'
let curDetections = []
let expressionTimer = 0
let fullyLoaded = false

let lastFrameTime = 0

const emotionData = {
    happy: {
        color: '#48ac8e',
        iframeSrc: 'https://open.spotify.com/embed/playlist/0dE8vbdraRNCDl1NsYONup',
        trackingImg: haloImg,
        imgXOffset: 0,
        imgYOffset: -75,
        widthOffset: 0
    },
    sad: {
        color: '#4888ac',
        iframeSrc: 'https://open.spotify.com/embed/playlist/17Y3RLFVntdr03GZKu0cGq',
        trackingImg: cloudImg,
        imgXOffset: 0,
        imgYOffset: 0,
        widthOffset: 0
    },
    surprised: {
        color: '#5648ac',
        iframeSrc: 'https://open.spotify.com/embed/playlist/43Fufavc3oJplTbaDkcdQg',
        trackingImg: exclamationImg,
        imgXOffset: 0,
        imgYOffset: -50,
        widthOffset: 150
    },
    angry: {
        color: '#ac4848',
        iframeSrc: 'https://open.spotify.com/embed/playlist/1lQDVNlOfd8jkcvdUbU25J',
        trackingImg: devilImg,
        imgXOffset: 0,
        imgYOffset: 0,
        widthOffset: 0
    }
}

// Load models, set up webcam
async function run() {
    // load the models
    const MODEL_URL = '/public/models'
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)

    // try to access users webcam and stream the images
    // to the video element
    navigator.mediaDevices
        .getUserMedia({
            video: { width: { min: 1024, ideal: 1280, max: 1920 }, height: { min: 576, ideal: 720, max: 1080 } }
        })
        .then(async (stream) => {
            videoEl.srcObject = stream
            //transition to app
            accessContainer.style.display = 'none'
            camContainer.style.display = 'block'
        })
        .catch((err) => {
            console.error('error:', err)
        })
}

// when video plays, create overlay canvas and run detections
videoEl.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(videoEl)
    camContainer.append(canvas)

    const displaySize = { width: videoEl.videoWidth, height: videoEl.videoHeight }
    faceapi.matchDimensions(canvas, displaySize)

    window.requestAnimationFrame(function () {
        processFrame(canvas, displaySize)
    })
})

// call all frame processes here and repeat on animation frame
async function processFrame(canvas, displaySize) {
    if (!animationStarted) {
        onboardAnimation()
        animationStarted = true
    }
    await detectFace(canvas, displaySize)
    await convertASCII(canvas, displaySize)
    await drawImages(canvas)
    await drawFeatures(canvas)

    window.requestAnimationFrame(async function (currentFrameTime) {
        const elapsedTime = currentFrameTime - lastFrameTime

        // wait to proceed until 200ms has elapsed from the last frame
        // this throttles animation to 5 fps
        if (elapsedTime < 200) {
            await new Promise((res) => setTimeout(res, 200 - elapsedTime))
        }
        lastFrameTime = currentFrameTime

        processFrame(canvas, displaySize)
    })
}

async function onboardAnimation() {
    const images = Array.prototype.slice.call(animationContainer.childNodes).filter(function (child) {
        return child.nodeName === 'IMG'
    })

    for (let i = 0; i < images.length; i++) {
        images[i].style.opacity = 1
        await new Promise((res) => setTimeout(res, 2000))
        images[i].style.opacity = 0
    }

    document.querySelector('#camContainer canvas').style.opacity = 1
}

// detect face, landmarks and expressions
async function detectFace(canvas, displaySize) {
    const detections = await faceapi
        .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceExpressions()

    await readExpression(detections)
    curDetections = detections
}

// find the most likely expression
async function readExpression(detections) {
    if (detections[0]) {
        const expressions = detections[0].expressions

        let highestGrade = 0.0
        let expressionRead = ''

        Object.keys(expressions).forEach((key) => {
            if (expressions[key] > highestGrade) {
                highestGrade = expressions[key]
                expressionRead = key
            }
        })

        if (
            highestGrade > 0.8 &&
            expressionRead !== 'neutral' &&
            expressionRead !== 'disgusted' &&
            expressionRead !== 'fearful'
        ) {
            if (!(fullyLoaded && expressionRead === curExpressionRead)) {
                await updateEmotion(expressionRead)
            }
        }
    }
}

async function updateEmotion(expressionRead) {
    // expression changes
    if (curExpressionRead !== expressionRead) {
        // update current expression
        curExpressionRead = expressionRead
        fullyLoaded = false

        // reset color box
        expressionTimer = 0
        colorBox.style.height = 0
        colorBox.className = ''
        colorBox.className = curExpressionRead
        // expression stays the same
    } else {
        if (expressionTimer < 100) {
            // increase height of the box by 4%
            expressionTimer += 4
            colorBox.style.height = expressionTimer + '%'
        } else if (expressionTimer === 100) {
            colorBox.style.height = '100%'
            curExpressionLoaded = curExpressionRead
            fullyLoaded = true
            document.body.className = ''
            document.body.className = curExpressionLoaded
            emotionHeader.innerHTML = curExpressionLoaded.toUpperCase()

            // update spotify player
            spotifyPlayer.style.opacity = '0'
            playerShadow.style.opacity = '0'
            spotifyPlayer.src = emotionData[curExpressionLoaded].iframeSrc
            playerShadow.className = ''
            playerShadow.className = curExpressionLoaded
            spotifyPlayer.addEventListener('load', function () {
                spotifyPlayer.style.opacity = '1'
                playerShadow.style.opacity = '1'
            })
        }
    }
}

async function convertASCII(canvas, displaySize) {
    const fontHeight = 24

    const outputContext = canvas.getContext('2d')
    const hiddenCanvas = document.getElementById('hiddenCanvas')
    const hiddenContext = hiddenCanvas.getContext('2d')
    hiddenCanvas.width = displaySize.width
    hiddenCanvas.height = displaySize.height

    await outputContext.clearRect(0, 0, canvas.width, canvas.height)

    await hiddenContext.drawImage(videoEl, 0, 0, displaySize.width, displaySize.height)

    canvas.textBaseline = 'top'
    outputContext.font = `${fontHeight}px Consolas`

    const text = outputContext.measureText('@')
    const fontWidth = parseInt(text.width)

    for (let y = 0; y < displaySize.height; y += fontHeight) {
        for (let x = 0; x < displaySize.width; x += fontWidth) {
            const frameSection = hiddenContext.getImageData(x, y, fontWidth, fontHeight)
            const { r, g, b } = getAverageRGB(frameSection)

            const asciiCode = Math.floor(Math.random() * 60 + 30)

            outputContext.fillStyle = `rgb(${r},${g},${b})`
            outputContext.fillText(String.fromCharCode(asciiCode), x, y)
        }
    }
}

function getAverageRGB(frame) {
    const length = frame.data.length / 4

    let r = 0
    let g = 0
    let b = 0

    for (let i = 0; i < length; i++) {
        r += frame.data[i * 4 + 0]
        g += frame.data[i * 4 + 1]
        b += frame.data[i * 4 + 2]
    }

    return {
        r: r / length,
        g: g / length,
        b: b / length
    }
}

async function drawImages(canvas) {
    if (curDetections[0] && curExpressionLoaded !== 'neutral') {
        const ctx = canvas.getContext('2d')
        const curData = emotionData[curExpressionLoaded]

        const imgEl = curData.trackingImg
        const imgWidth = curDetections[0].detection._box._width + curData.widthOffset
        const imgHeight = (imgWidth / imgEl.width) * imgEl.height
        const imgX = curDetections[0].detection._box._x + curData.imgXOffset - curData.widthOffset / 2
        const imgY = curDetections[0].detection._box._y - imgHeight + curData.imgYOffset

        await ctx.drawImage(imgEl, imgX, imgY, imgWidth, imgHeight)
    }
}

async function drawFeatures(canvas) {
    if (curDetections[0]) {
        const ctx = canvas.getContext('2d')
        const d = curDetections[0].landmarks._positions

        if (curExpressionLoaded === 'neutral') {
            // all features drawn from screen orientation
            // left
            drawEye(ctx, 36, 39, 37, 41, '#ac7e48')
            drawEyeBrow(ctx, d[17].x, d[21].x, d[17].y, d[21].y, true, '#ac7e48')

            // right
            drawEye(ctx, 42, 45, 47, 43, '#ac7e48')
            drawEyeBrow(ctx, d[22].x, d[26].x, d[22].y, d[26].y, false, '#ac7e48')

            drawMouth(ctx, d[48].x, d[54].x, d[48].y, d[54].y, '#ac7e48')
        } else if (curDetections[0] && curExpressionLoaded !== 'neutral') {
            const curData = emotionData[curExpressionLoaded]

            // left
            drawEye(ctx, 36, 39, 37, 41, curData.color)
            drawEyeBrow(ctx, d[17].x, d[21].x, d[17].y, d[21].y, true, curData.color)

            //right
            drawEye(ctx, 42, 45, 47, 43, curData.color)
            drawEyeBrow(ctx, d[22].x, d[26].x, d[22].y, d[26].y, false, curData.color)

            drawMouth(ctx, d[48].x, d[54].x, d[48].y, d[54].y, curData.color)
        }
    }
}

function drawEye(ctx, x1, x2, y1, y2, fillColor) {
    const d = curDetections[0].landmarks._positions

    const circleX = (d[x2].x - d[x1].x) / 2 + d[x1].x
    const circleY = (d[y2].y - d[y1].y) / 2 + d[y1].y
    const circleRadius = (d[x2].x - d[x1].x) / 2

    ctx.beginPath()
    ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI)
    ctx.fillStyle = fillColor
    ctx.fill()
}

function drawEyeBrow(ctx, x1, x2, y1, y2, left, fillColor) {
    const width = x2 - x1
    const height = 10

    let deg

    ctx.save()
    ctx.beginPath()
    ctx.translate(x1 + width / 2, y1 + height / 2)
    const angleRad = Math.atan((y2 - y1) / width)
    ctx.rotate(angleRad)

    switch (curExpressionRead) {
        case 'happy' || 'neutral':
            ctx.rect(-width / 2, -25, x2 - x1, height)
            break
        case 'angry':
            left ? (deg = 15) : (deg = 345)
            ctx.rotate(deg * (Math.PI / 180))
            ctx.rect(-width / 2, -30, x2 - x1, height)
            break
        case 'sad':
            left ? (deg = 330) : (deg = 30)
            ctx.rotate(deg * (Math.PI / 180))
            ctx.rect(-width / 2, -15, x2 - x1, height)
            break
        case 'surprised':
            ctx.ellipse(0, -20, width / 2, (width / 2) * 0.5, 0, Math.PI, 2 * Math.PI)
            break
        default:
            ctx.rect(-width / 2, -15, x2 - x1, height)
    }

    ctx.fillStyle = fillColor
    ctx.fill()
    ctx.restore()
}

function drawMouth(ctx, x1, x2, y1, y2, fillColor) {
    const width = x2 - x1
    const height = 15

    const circleX = (x2 - x1) / 2 + x1
    const circleY = (y2 - y1) / 2 + +y1
    const circleWidth = width / 2

    ctx.save()
    ctx.beginPath()
    ctx.translate(x1 + width / 2, y1 + height / 2)
    const angleRad = Math.atan((y2 - y1) / width)
    ctx.rotate(angleRad)

    switch (curExpressionRead) {
        case 'happy':
            ctx.ellipse(0, 0, circleWidth, circleWidth * 0.5, 0, 0, Math.PI)
            break
        case 'angry' || 'neutral':
            ctx.rect(-width / 2, -height / 2, width, height)
            break
        case 'sad':
            ctx.ellipse(0, 0, circleWidth, circleWidth * 0.5, 0, Math.PI, 2 * Math.PI)
            break
        case 'surprised':
            ctx.ellipse(0, 0, circleWidth, circleWidth * 1.15, 0, 0, 2 * Math.PI)
            break
        default:
            ctx.rect(-width / 2, -height / 2, width, height)
    }

    ctx.fillStyle = fillColor
    ctx.fill()
    ctx.restore()
}

// listen for load event in the window
window.addEventListener('load', run)
