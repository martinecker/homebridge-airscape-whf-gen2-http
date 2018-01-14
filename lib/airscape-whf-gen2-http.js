/* jshint esversion: 6 */
/* jshint node: true */

'use strict';

const request = require('request');

const defaultState = {
    isAvailable: false,
    model: "",
    softwareVersion: "0.0",
    macAddress: "00:00:00:00:00:00",
    speed: 0,
    areDoorsMoving: false,
    timeRemaining: 0,
    temperatureInside: 0,
    temperatureOutside: 0,
    tempartureAttic: 0
};

function sleep(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

var AirScapeGen2 = function (ip) {
    this.ip = ip;
    this.getStateUrl = '/status.json.cgi';
    this.incSpeedUrl = '/fanspd.cgi?dir=1';
    this.decSpeedUrl = '/fanspd.cgi?dir=3';
    this.turnOffUrl = '/fanspd.cgi?dir=4';
    this.lastGetFullStateTime = [0, 0];
    this.cachedState = defaultState;
};

AirScapeGen2.prototype._changeState = function (url) {
    return new Promise((resolve, reject) => {
        request.get('http://' + this.ip + url,
             (error, response, body) => {
                if (error)
                    reject(error);
                else if (response.statusCode != 200)
                    reject(new Error(`Unexpected response. Status code ${response.statusCode}`));
                else
                    resolve();
            }
        );
    });
};

AirScapeGen2.prototype.getFullState = function () {
    return new Promise((resolve, reject) => {
        // If the last successful call to this function wasn't that long ago, just return the already known
        // state instead of querying the fan again, because that's costly.
        const timeDiff = process.hrtime(this.lastGetFullStateTime);
        const timeDiffMs = timeDiff[0] * 1e6 + timeDiff[1] / 1000;
        if (timeDiffMs <= 250) {
            resolve(this.cachedState);
            return;
        }

        request.get({ url: 'http://' + this.ip + this.getStateUrl, timeout: 5000 },
            (error, response, body) => {
                if (error) {
                    if (error.code == 'EHOSTUNREACH' || error.code == 'ETIMEDOUT' || error.code == 'ECONNREFUSED') {    // Consider receiver as unavailable for these errors
                        this.cachedState = defaultState;
                        this.lastGetFullStateTime = process.hrtime();
                        resolve(this.cachedState);
                    } else {
                        reject(error);
                    }
                } else if (response.statusCode != 200) {
                    reject(new Error(`Unexpected response. Status code ${response.statusCode}`));
                } else {
                    // Remove "server_response" entry data because it seems to contain unparsable garbage.
                    const bodyWithoutServerResponse = body.replace(/\"server_response\"\: \"(.|\s)*?\"\,/, '"server_response": "",');
                    const parsedState = JSON.parse(bodyWithoutServerResponse);
                    
                    this.cachedState = {
                        isAvailable: true,
                        model: parsedState.model,
                        softwareVersion: parsedState.softver,
                        macAddress: parsedState.macaddr,
                        speed: parsedState.fanspd,
                        areDoorsMoving: parsedState.doorinprocess != 0,
                        timeRemaining: parsedState.timeremaining,
                        temperatureInside: parsedState.inside,
                        temperatureOutside: parsedState.oa,
                        tempartureAttic: parsedState.attic
                    };
                    
                    this.lastGetFullStateTime = process.hrtime();
                    resolve(this.cachedState);
                }
            }
        );
    });
};

AirScapeGen2.prototype.isAvailable = async function () {
    return this.getFullState().then(state => { return state.isAvailable; });
};

AirScapeGen2.prototype.areDoorsMoving = async function (callback) {
    return this.getFullState().then(state => { return state.areDoorsMoving; });
};

AirScapeGen2.prototype.getSpeed = async function (callback) {
    return this.getFullState().then(state => { return state.speed; });
};

AirScapeGen2.prototype.getTemperatureInside = async function (callback) {
    return this.getFullState().then(state => { return state.temperatureInside; });
};

AirScapeGen2.prototype.getTemperatureOutside = async function (callback) {
    return this.getFullState().then(state => { return state.temperatureOutside; });
};

AirScapeGen2.prototype.getTemperatureAttic = async function (callback) {
    return this.getFullState().then(state => { return state.temperatureAttic; });
};

AirScapeGen2.prototype.waitDoorsIdle = async function () {
    for (;;) {
        this.lastGetFullStateTime = [0, 0]; // force getFullState to query the fan directly instead of returning early with cached state
        var newState = await this.getFullState();
        if (!newState.areDoorsMoving)
            break;
        await sleep(1000);
    }
};

AirScapeGen2.prototype.waitForSpeedSet = async function (speed) {
    for (;;) {
        this.lastGetFullStateTime = [0, 0]; // force getFullState to query the fan directly instead of returning early with cached state
        var newState = await this.getFullState();
        if (newState.speed == speed)
            break;
        await sleep(400);
    }
};

AirScapeGen2.prototype.turnOff = async function () {
    await this.getFullState();
    if (this.cachedState.speed == 0)
        return;

    return this._changeState(this.turnOffUrl).then(() => { this.cachedState.speed = 0; });
};

AirScapeGen2.prototype.incSpeed = async function () {
    await this.getFullState();
    if (this.cachedState.speed == 7)
        return 7;

    return this._changeState(this.incSpeedUrl).then(() => { return ++this.cachedState.speed; });
};

AirScapeGen2.prototype.decSpeed = async function () {
    await this.getFullState();
    if (this.cachedState.speed == 0)
        return 0;

    return this._changeState(this.decSpeedUrl).then(() => { return --this.cachedState.speed; });
};

AirScapeGen2.prototype.setSpeed = async function (speed) {
    await this.getFullState();
    while (this.cachedState.speed != speed)
    {
        if (this.cachedState.speed > speed) {
            const desiredSpeed = this.cachedState.speed - 1;
            await this._changeState(this.decSpeedUrl);
            await this.waitForSpeedSet(desiredSpeed);
        } else {
            const desiredSpeed = this.cachedState.speed + 1;
            await this._changeState(this.incSpeedUrl);
            await this.waitForSpeedSet(desiredSpeed);
            if (desiredSpeed == 1)
                await this.waitDoorsIdle();
        }
    }
    return speed;
};

module.exports = AirScapeGen2;
