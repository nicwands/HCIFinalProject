// Global vars
const videoEl = document.getElementById('inputVideo')
const camContainer = document.getElementById('camContainer')
const colorBox = document.getElementById('colorBox')

let curExpression = 'neutral'
let expressionTimer = 0

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
        // convertASCII(canvas, displaySize)
        detectFace(canvas, displaySize)
    })
})

// detect face, landmarks and expressions
async function detectFace(canvas, displaySize) {
    const detections = await faceapi
        .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceExpressions()

    console.log(detections)
    readExpression(detections)
    const resizedDetections = faceapi.resizeResults(detections, displaySize)
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    faceapi.draw.drawDetections(canvas, resizedDetections)
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

    window.requestAnimationFrame(function () {
        detectFace(canvas, displaySize)
    })
}

async function convertASCII(canvas, displaySize) {
    // await aalib.read.video
    //     .fromVideoElement(videoEl)
    //     .map(aalib.aa(displaySize))
    //     .map(aalib.render.canvas({ el: canvas }))

    const fontHeight = 12

    const outputContext = canvas.getContext('2d')
    const hiddenCanvas = document.getElementById('hiddenCanvas')
    const hiddenContext = hiddenCanvas.getContext('2d')
    hiddenCanvas.width = displaySize.width
    hiddenCanvas.height = displaySize.height

    hiddenContext.drawImage(videoEl, 0, 0, displaySize.width, displaySize.height)

    canvas.textBaseline = 'top'
    outputContext.font = `${fontHeight}px Consolas`

    const text = outputContext.measureText('@')
    const fontWidth = parseInt(text.width)

    for (let y = 0; y < displaySize.height; y += fontHeight) {
        for (let x = 0; x < displaySize.width; x += fontWidth) {
            const frameSection = hiddenContext.getImageData(x, y, fontWidth, fontHeight)
            //   const { r, g, b } = getAverageRGB(frameSection);

            //   outputContext.fillStyle = `rgb(${r},${g},${b})`;
            outputContext.fillText('@', x, y)
        }
    }
}

// find the most likely expression
function readExpression(detections) {
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

        if (curExpression !== expressionRead) {
            expressionTimer = 0
            colorBox.style.height = 0
            curExpression = expressionRead
            colorBox.className = ''
            colorBox.className = curExpression
        } else {
            expressionTimer += 1
            colorBox.style.height = expressionTimer * 50 + 'px'
        }
    }
}

// listen for load event in the window
window.addEventListener('load', run)
