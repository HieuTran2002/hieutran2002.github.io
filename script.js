const gas_tank_size_input = document.getElementById("gas_tank_size_input");
const gas_tank_size_input_items = document.querySelectorAll(".gas_tank_size_items");

const gas_supplier_input = document.getElementById("gas_supplier_input");
const gas_supplier_input_items = document.querySelectorAll(".gas_supplier_input_items");


// console.log(gas_tank_size_input_items.length)
gas_tank_size_input_items.forEach((item) => {
    item.addEventListener("click", () => {
        gas_tank_size_input.value = item.textContent;
        console.log(item.textContent)
    });
});


// console.log(gas_supplier_input_items.length)
gas_supplier_input_items.forEach((item) => {
    item.addEventListener("click", () => {
        gas_supplier_input.value = item.textContent;
        console.log(item.textContent)
    });
});

// save image ----
document.getElementById("capture-btn").addEventListener("click", function () {

    html2canvas(document.querySelector('#result-display')).then(function (canvas) {

        var currentdate = new Date();
        let time = currentdate.getDate() + "" + currentdate.getHours() + "" + currentdate.getMinutes() + "" + currentdate.getSeconds() + '.jpg';

        console.log(time);
        saveAs(canvas.toDataURL(), time);
    });
});


function saveAs(uri, filename) {

    var link = document.createElement('a');

    if (typeof link.download === 'string') {

        link.href = uri;
        link.download = filename;

        //Firefox requires the link to be in the body
        document.body.appendChild(link);

        //simulate click
        link.click();

        //remove the link when done
        document.body.removeChild(link);

    } else {

        window.open(uri);

    }
}


// ------------- OpenCV session --------------- // 
console.log("Getting things ready.")
let Module = {
    onRuntimeInitialized() {
        onOpenCvReady()
    }
};
let width = 0;
let height = 0;
let heightBirdeye = 0;

function cvtX(x) {
    let pixelPerX = (width - 3) / 80;
    let pixel = (x + 40) * pixelPerX;
    return Math.floor(pixel);
}

function cvtY(y) {
    y *= 10;
    y = 96 - y;
    let pixelPerY = heightBirdeye / 96;
    let pixel = y * pixelPerY;
    return Math.floor(pixel);
}

function cvtPoint(point) {
    if (point.length != 2) {
        console.log("Point len = 3");
        throw new Error("Invalid point length");
    }
    return [cvtX(point[0]), cvtY(point[1])];
}

function drawLineX(image, x, color = [255, 0, 0, 255], thick = 1) {
    let pt1 = new cv.Point(x, 0);
    let pt2 = new cv.Point(x, height);
    cv.line(image, pt1, pt2, color, thick);
}

function drawLineY(image, y, color = [0, 0, 255, 255], thick = 1) {
    let pt1 = new cv.Point(0, y);
    let pt2 = new cv.Point(width, y);
    cv.line(image, pt1, pt2, color, thick);
}

function drawColumns(image) {
    for (let i = -40; i <= 40; i += 2) {
        if (i % 10 == 0) {
            drawLineX(image, cvtX(i), [255, 0, 0, 255], 2);

        }
    }
}

function drawRows(image) {
    for (let i = 0; i < 98; i += 2) {
        if (i % 10 == 0) {
            drawLineY(image, cvtY(i / 10), [0, 0, 255, 255], 2);

        }
        else {
            drawLineY(image, cvtY(i / 10));
        }
    }
}

function drawX(image, x) {
    drawLineX(image, cvtX(x), [255, 255, 255, 255], 4);
    drawLineX(image, cvtX(x), [255, 0, 255, 255], 4);
}

function drawY(image, y) {
    drawLineY(image, cvtY(y), [255, 255, 255, 255], 4);
    drawLineY(image, cvtY(y), [255, 0, 255, 255], 4);
}

function checkPoint(image, point) {
    let result = 0;
    let yuv = new cv.Mat();
    cv.cvtColor(image, yuv, cv.COLOR_BGR2YUV);
    let mask = new cv.Mat();

    let low = new cv.Mat(image.rows, image.cols, image.type(), [0, 0, 0, 0]);
    let high = new cv.Mat(image.rows, image.cols, image.type(), [20, 255, 255, 255]);
    // You can try more different parameters
    cv.inRange(image, low, high, mask);


    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < contours.size(); ++i) {
        let contour = contours.get(i);
        let area = cv.contourArea(contour, false);
        if (area > 10000) {
            result = cv.pointPolygonTest(contour, new cv.Point(...cvtPoint(point)), false);
            if (result >= 0) {
                console.log(`Point ${point} is inside the contour.`);
            } else {
                console.log(`Point ${point} is outside the contour.`);
            }
        }
    }

    // cv.imshow('table', mask);

    yuv.delete();
    mask.delete();
    contours.delete();
    hierarchy.delete();
    return result
}

function orderPoints(pts) {
    let rect = new cv.Mat(4, 2, cv.CV_32FC1);
    let s = cv.sum(pts);
    let diff = new cv.Mat();
    cv.subtract(pts.col(1), pts.col(0), diff);

    rect.floatPtr(0, 0)[0] = pts.floatPtr(cv.argMin(s), 0)[0];
    rect.floatPtr(0, 1)[0] = pts.floatPtr(cv.argMin(diff), 0)[0];
    rect.floatPtr(1, 0)[0] = pts.floatPtr(cv.argMax(diff), 0)[0];
    rect.floatPtr(2, 0)[0] = pts.floatPtr(cv.argMax(s), 0)[0];
    rect.floatPtr(3, 0)[0] = pts.floatPtr(cv.argMin(diff), 0)[0];

    return rect;
}

function fourPointTransform(image, pts) {
    let rect = orderPoints(pts);
    let [tl, tr, br, bl] = [rect.row(0), rect.row(1), rect.row(2), rect.row(3)];

    let widthA = Math.sqrt(Math.pow(br.floatAt(0, 0) - bl.floatAt(0, 0), 2) + Math.pow(br.floatAt(0, 1) - bl.floatAt(0, 1), 2));
    let widthB = Math.sqrt(Math.pow(tr.floatAt(0, 0) - tl.floatAt(0, 0), 2) + Math.pow(tr.floatAt(0, 1) - tl.floatAt(0, 1), 2));
    let maxWidth = Math.max(widthA, widthB);

    let heightA = Math.sqrt(Math.pow(tr.floatAt(0, 0) - br.floatAt(0, 0), 2) + Math.pow(tr.floatAt(0, 1) - br.floatAt(0, 1), 2));
    let heightB = Math.sqrt(Math.pow(tl.floatAt(0, 0) - bl.floatAt(0, 0), 2) + Math.pow(tl.floatAt(0, 1) - bl.floatAt(0, 1), 2));
    let maxHeight = Math.max(heightA, heightB);

    let dst = cv.matFromArray(4, 2, cv.CV_32FC1, [
        0, 0,
        maxWidth - 1, 0,
        maxWidth - 1, maxHeight - 1,
        0, maxHeight - 1
    ]);

    let M = cv.getPerspectiveTransform(rect, dst);
    let dsize = new cv.Size(maxWidth, maxHeight);
    let warped = new cv.Mat();
    cv.warpPerspective(image, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    return warped;
}

function processImage() {
    let imgElement = document.getElementById('imageSrc');

    let src = cv.imread(imgElement);

    width = src.cols;
    height = src.rows;


    console.log("yooo")
    heightBirdeye = height

    let point = [
        parseInt(document.getElementById('temperature_textbox').value, 10),
        parseInt(document.getElementById('pressure_textbox').value, 10)

    ];
    let result = checkPoint(src, point);
    drawColumns(src);
    drawRows(src);
    drawX(src, point[0]);
    drawY(src, point[1]);
    cv.imshow('outputCanvas', src);

    src.delete();
    return result
}

function onOpenCvReady() {
    console.log('OpenCV.js is ready.');
}
function checkBTN_clicked() {
    let result = processImage();
    console.log(result)
    if (result >= 0) {
        document.getElementById("result-label").innerText = 'Dat';
        document.getElementById("result-label").style.backgroundColor = "#A3BE8C";
    }
    else {
        document.getElementById("result-label").innerText = 'Khong Dat';
        document.getElementById("result-label").style.backgroundColor = '#BF616A';

    }
    var currentdate = new Date();
    document.getElementById('result-display-time').innerText = currentdate.getDate() + "/"
        + (currentdate.getMonth() + 1) + "/"
        + currentdate.getFullYear();
    document.getElementById('result-display-date').innerText = currentdate.getHours() + ":"
        + currentdate.getMinutes() + ":"
        + currentdate.getSeconds();
}