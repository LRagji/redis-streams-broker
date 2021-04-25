async function processPayload(data) {
    if (data == null) {
        return "Rollover";
    }

    if ((parseInt(data.lhs) + parseInt(data.rhs)) === parseInt(data.result)) {
        await new Promise((acc, rej) => setTimeout(acc, 5000));// Fake delay simulating network or cpu load.
        return ""
    }
    else {
        return "Failed math exam!!!";
    }
}

module.exports = processPayload;