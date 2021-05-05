// Global vars
const videoEl = document.getElementById('inputVideo')
const camContainer = document.getElementById('camContainer')
const colorBox = document.getElementById('colorBox')
const emotionHeader = document.getElementById('emotionHeader')
const spotifyPlayer = document.getElementById('spotifyPlayer')
const playerShadow = document.getElementById('shadow')

let curExpression = 'neutral'
let expressionTimer = 0
let fullyLoaded = false

let lastFrameTime = 0

const emotionData = {
    neutral: {
        iframeSrc: ''
    },
    happy: {
        iframeSrc: 'https://open.spotify.com/embed/playlist/0dE8vbdraRNCDl1NsYONup'
    },
    sad: {
        iframeSrc: 'https://open.spotify.com/embed/playlist/17Y3RLFVntdr03GZKu0cGq'
    },
    surprised: {
        iframeSrc: 'https://open.spotify.com/embed/playlist/43Fufavc3oJplTbaDkcdQg'
    },
    angry: {
        iframeSrc: 'https://open.spotify.com/embed/playlist/1lQDVNlOfd8jkcvdUbU25J'
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

    // console.log(detections)

    await readExpression(detections)

    const resizedDetections = await faceapi.resizeResults(detections, displaySize)

    await canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    // await faceapi.draw.drawDetections(canvas, resizedDetections)
    await faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    // await faceapi.draw.drawFaceExpressions(canvas, resizedDetections)
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

        if (highestGrade > 0.8 && expressionRead !== 'neutral') {
            if (!(fullyLoaded && expressionRead === curExpression)) {
                await updateEmotion(expressionRead)
            }
        }
    }
}

async function updateEmotion(expressionRead) {
    // expression changes
    if (curExpression !== expressionRead) {
        // update current expression
        curExpression = expressionRead
        fullyLoaded = false

        // reset color box
        expressionTimer = 0
        colorBox.style.height = 0
        colorBox.className = ''
        colorBox.className = curExpression
        // expression stays the same
    } else {
        if (expressionTimer < 96) {
            // increase height of the box by 4%
            expressionTimer += 4
            colorBox.style.height = expressionTimer + '%'
        } else if (expressionTimer === 96) {
            colorBox.style.height = '100%'
            fullyLoaded = true

            // update emotion header
            emotionHeader.innerHTML = curExpression.toUpperCase()

            // update spotify player
            spotifyPlayer.style.opacity = '0'
            playerShadow.style.opacity = '0'
            spotifyPlayer.src = emotionData[curExpression].iframeSrc
            playerShadow.className = ''
            playerShadow.className = curExpression
            spotifyPlayer.addEventListener('load', function () {
                spotifyPlayer.style.opacity = '1'
                playerShadow.style.opacity = '1'
                simulateClick()
            })
        }
    }
}

async function simulateClick() {
    console.log('in simulate')
    // oEvent = document.createEvent('MouseEvents')
    // oEvent.initMouseEvent(
    //     'click',
    //     true,
    //     true,
    //     document.defaultView,
    //     0,
    //     20,
    //     20,
    //     20,
    //     20,
    //     false,
    //     false,
    //     false,
    //     false,
    //     0,
    //     spotifyPlayer
    // )
    // console.log(oEvent)
    // spotifyPlayer.dispatchEvent(oEvent)

    await new Promise((res) => setTimeout(res, 1000))

    const coordinates = spotifyPlayer.getBoundingClientRect()

    const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: coordinates.x + 40,
        clientY: coordinates.y + 40
    })

    // document.dispatchEvent(event)
    document.querySelector('iframe').contentWindow.document.querySelector('[title="Play"]').click()
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

// listen for load event in the window
window.addEventListener('load', run)

window.addEventListener('click', function (data) {
    console.log(data)
})
