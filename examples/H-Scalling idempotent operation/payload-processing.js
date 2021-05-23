async function processPayload(data) {
    try {

        if ((parseInt(data.lhs) + parseInt(data.rhs)) === parseInt(data.result)) {
            await new Promise((acc, rej) => setTimeout(acc, 5000));// Fake delay simulating network or cpu load.
            return true;
        }
        else {
            return false;
        }
    }
    catch (err) {
        return false;
    }
}

module.exports = processPayload;