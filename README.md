# Homebridge-AirScape-WHF-Gen2-HTTP

Developed by Martin Ecker in 2018.

This is a [Homebridge](https://github.com/nfarina/homebridge) plugin for [AirScape](http://www.airscapefans.com/) whole house fans with [2nd generation controls](https://usa.denon.com/us/product/hometheater/receivers/avr3808ci) via HTTP that enables Apple-HomeKit/Siri control of the fan speed. If you have the [TSP Temperature Sensor Package](http://www.airscapefans.com/learn-about/tsp-explained.php) this plugin also provides temperature sensors for inside, outside, and attic temperatures.

## Installation

1. Install homebridge using: `sudo npm install -g homebridge`
1. Install this plugin using: `sudo npm install -g homebridge-denon-avr3808ci-http`
1. Update your configuration file as described below.
1. Restart homebridge. If you're running it as systemd service this is typically done via `sudo systemctl restart homebridge`.

## Configuration

This plugin implements a Homebridge accessory and as such a new section needs to be added to the `"accessories"` section in `config.json`.

Here's an example that shows all options the plugin offers:

```json
    "accessories":
    [
        {
            "accessory": "AirScape-WHF-Gen2-HTTP",
            "name": "Whole House Fan",
            "ip": "192.168.1.113",
            "pollingIntervalMs": "15000",
            "hasTPS": "true"
        }
    ]
```

* **"accessory"** (required): This needs to be set to `"AirScape-WHF-Gen2-HTTP"`
* **"name"** (required): This can be any name you want to assign to this particular fan. This is how it will show up in the Home app and also how Siri will recognize it. You should pick an easy to say, unique name.
* **"ip"** (required): The IP address of your whole house fan. You may want to make sure you assign a fixed IP to your AirScape WHF in your router.
* **"pollingIntervalMs"** (optional, default "15000"): In order to keep HomeKit synchronized with external changes made to the fan (for example, via the remote), this plugin polls the fan's status at regular intervals. The interval length is controlled with this option, which specifies a time duration in milliseconds. The default is "15000" or 15 seconds.
* **"hasTSP"** (optional, default "false"): If set to "true" indicates that the whole house fan has the optional temperature sensor package installed. This makes this plugin expose three temperature sensors to HomeKit for inside, outside, and attic temperature.

## License

ISC License (ISC)
Copyright 2018 Martin Ecker

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.