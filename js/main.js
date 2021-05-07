// Global vars
const videoEl = document.getElementById('inputVideo')
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
        .then((stream) => {
            videoEl.srcObject = stream
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
    await detectFace(canvas, displaySize)
    // await convertASCII(canvas, displaySize)
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

// detect face, landmarks and expressions
async function detectFace(canvas, displaySize) {
    const detections = await faceapi
        .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceExpressions()

    await readExpression(detections)

    const resizedDetections = await faceapi.resizeResults(detections, displaySize)
    const ctx = canvas.getContext('2d')
    await ctx.clearRect(0, 0, canvas.width, canvas.height)
    // await faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)

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

    await hiddenContext.drawImage(videoEl, 0, 0, displaySize.width, displaySize.height)

    canvas.textBaseline = 'top'
    outputContext.font = `${fontHeight}px Consolas`

    const text = outputContext.measureText('@')
    const fontWidth = parseInt(text.width)

    for (let y = 0; y < displaySize.height; y += fontHeight) {
        for (let x = 0; x < displaySize.width; x += fontWidth) {
            const frameSection = hiddenContext.getImageData(x, y, fontWidth, fontHeight)
            const { r, g, b } = getAverageRGB(frameSection)

            const asciiCode = Math.floor(Math.random() * 60 + 60)

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
    const ctx = canvas.getContext('2d')

    if (curDetections[0]) {
        if (curExpressionLoaded === 'neutral') {
            drawEye(ctx, 36, 39, 37, 41, '#ac7e48')
            drawEye(ctx, 42, 45, 47, 43, '#ac7e48')
        } else if (curDetections[0] && curExpressionLoaded !== 'neutral') {
            const curData = emotionData[curExpressionLoaded]

            drawEye(ctx, 36, 39, 37, 41, curData.color)
            drawEye(ctx, 42, 45, 47, 43, curData.color)
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

// listen for load event in the window
window.addEventListener('load', run)
