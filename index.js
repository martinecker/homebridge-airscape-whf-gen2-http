/* jshint esversion: 6 */
/* jshint node: true */

'use strict';

var Service, Characteristic;
const AirScapeGen2 = require('./lib/airscape-whf-gen2-http');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-airscape-whf-gen2-http', 'AirScape-WHF-Gen2-HTTP', AirScapeFanAccessory);
};

function getConfigIntWithDefaultAndRange(valueStr, defaultValue, minValue, maxValue) {
    if (!valueStr)
        return defaultValue;

    const value = parseInt(valueStr);
    if (value == Number.NaN)
        return defaultValue;

    return Math.min(Math.max(value, minValue), maxValue);
}

function convertSpeedToPercent(speed) {
    return speed / 7 * 100;
}

function convertPercentToSpeed(speedPercent) {
    return Math.round(speedPercent / 100 * 7);
}

function AirScapeFanAccessory(log, config) {
    this.log = log;
    this.config = config;

    if (!config.hasOwnProperty('ip'))
        this.log.error("'ip' config is missing!");
    if (!config.hasOwnProperty('name'))
        this.log.error("'name' config is missing!");

    // Extract configuration from config.json section.
    this.ip = config.ip;
    this.name = config.name;
    this.pollingIntervalMs = getConfigIntWithDefaultAndRange(config.pollingIntervalMs, 15000, 250, 600000); // clamp between 250 ms and 10 minutes, default to polling every 15 seconds

    this.airScape = new AirScapeGen2(this.ip);
}

AirScapeFanAccessory.prototype._updateState = async function () {
    clearTimeout(this.pollingTimeout);

    this.log(`Polling full AirScape WHF state...`);
    try {
        const newState = await this.airScape.getFullState();    
    
        this.log(`Polled full AirScape WHF state: available ` + (newState.isAvailable ? 'yes' : 'no') +
            ", model " + newState.model + ", software version " + newState.softwareVersion + ", MAC address " + newState.macAddress + 
            ", speed " + newState.speed + ", areDoorsMoving " + (newState.areDoorsMoving ? 'yes' : 'no') + 
            ", time remaining " + newState.timeRemaining + ", temp inside " + newState.temperatureInside + ", temp outside " + newState.temperatureOutside +
            ", temp attic " + newState.tempartureAttic);

        this.fanService.getCharacteristic(Characteristic.On).updateValue(newState.speed > 0, null, "polling");
        this.fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(convertSpeedToPercent(newState.speed), null, "polling");
    } catch (error) {
        this.log(`Couldn't poll full AirScape WHF state. Error: ` + error);
    }

    this.pollingTimout = setTimeout(this._updateState.bind(this), this.pollingIntervalMs);
};

AirScapeFanAccessory.prototype.getPowerState = async function (callback) {
    try {
        const speed = await this.airScape.getSpeed();
        this.log('AirScape WHF is %s', (speed > 0) ? 'ON' : 'OFF');
        callback(null, speed > 0);
    } catch (error) {
        this.log("AirScape WHF couldn't get power state: " + error);
        callback(error, false);
    }
};

AirScapeFanAccessory.prototype.setPowerState = async function (powerState, callback, context) {
    if (context && context == "polling") {
        callback(null, powerState);
        return;
    }

    try {
        const newState = await this.airScape.getFullState();
        if (powerState) {
            if (newState.speed > 0) {
                callback(null, true);   // already on
            } else {
                const newSpeed = await this.airScape.setSpeed(1);
                callback(null, newSpeed > 0);
                this.log("AirScape WHF set to ON");
            }
        } else {
            if (newState.speed == 0) {
                callback(null, false);  // already off
            } else {
                await this.airScape.turnOff();
                this.log("AirScape WHF set to OFF");
                callback(null, false);
            }
        }
    } catch (error) {
        this.log("AirScape WHF couldn't set power state: " + error);
        callback(error, false);
    }
};

AirScapeFanAccessory.prototype.getRotationSpeed = async function (callback) {
    try {
        const speed = await this.airScape.getSpeed();
        const speedPercent = convertSpeedToPercent(speed);
        this.log('AirScape WHF speed is ' + speed + ', ' + speedPercent + '%');
        callback(null, speedPercent);
    } catch (error) {
        this.log("AirScape WHF couldn't get speed: " + error);
        callback(error, 0);
    }
};

AirScapeFanAccessory.prototype.setRotationSpeed = async function (speedPercent, callback, context) {
    if (context && context == "polling") {
        callback(null, speedPercent);
        return;
    }

    try {
        const speed = convertPercentToSpeed(speedPercent);
        const newSpeed = await this.airScape.setSpeed(speed);
        this.log('AirScape WHF speed set to ' + speed + ', ' + speedPercent + '%');
        callback(null, convertSpeedToPercent(newSpeed));
    } catch (error) {
        this.log("AirScape WHF couldn't set speed: " + error);
        callback(error, 0);
    }
};

AirScapeFanAccessory.prototype.getServices = function () {
    this.informationService = new Service.AccessoryInformation();
    this.informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.SerialNumber, 'MAC <unknown>')
        .setCharacteristic(Characteristic.FirmwareRevision, '0.0.0')
        .setCharacteristic(Characteristic.Manufacturer, 'AirScape')
        .setCharacteristic(Characteristic.Model, 'Whole House Fan Gen2 Controls');

    this.fanService = new Service.Fan(this.name);
    this.fanService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));
    this.fanService
        .getCharacteristic(Characteristic.RotationSpeed)
        .on('get', this.getRotationSpeed.bind(this))
        .on('set', this.setRotationSpeed.bind(this));

    this.pollingTimout = setTimeout(this._updateState.bind(this), 1);

    const services = [this.informationService, this.fanService];
    return services;
};
