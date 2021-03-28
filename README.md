
<p align="center">

<img src="https://github.com/bram-is/homebridge-slide-shutter/raw/main/_assets/header.png" width="286">

</p>

# Homebridge Slide Shutter

[![Downloads](https://img.shields.io/npm/dt/homebridge-slide-shutter)](https://www.npmjs.com/package/homebridge-slide-shutter)
[![Version](https://img.shields.io/npm/v/homebridge-slide-shutter)](https://www.npmjs.com/package/homebridge-slide-shutter)

[![GitHub issues](https://img.shields.io/github/issues/bram-is/homebridge-slide-shutter)](https://github.com/bram-is/homebridge-slide-shutter/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/bram-is/homebridge-slide-shutter)](https://github.com/bram-is/homebridge-slide-shutter/pulls)


Homebridge plugin for [Slide](https://nl.slide.store/) by Innovation in Motion.

## Features

- Supports both local and remote API's simultaneously.
- A more finegrained control of Slides by the local API.
- Updates state correctly in HomeKit, also when controlled from an external source (eg. Slide app).
- Better performance than other plugins by optimising the poll rate and use the Slide curtain's calibration_time for more efficiency.

**NOTE:** A single curtain can only be configured in one mode: local or remote. A slide which was previously controlled by the remote API but now and now configured for the local API will still show up in the remote API. You can delete it from your remote account through the Slide App so you don't have duplicates in HomeKit.

## Installation

You can search in the HomeBridge `Plugins` tab for `homebridge-slide-shutter`. Follow instructions on screen to configure your slides:

<img src="https://github.com/bram-is/homebridge-slide-shutter/raw/main/_assets/config.png" width="100%">

### Manual installation
The following command can be used to install the plugin in Homebridge:

```bash
npm install -g homebridge-slide-shutter
```

After installing

After that you will need to enter the following details into the ~/.homebridge/config.json:

```JSON
{
  "platforms":[
    {
      "name": "slide-shutter",
      "tolerance": 5,
      "pollInterval": 20,
      "remote": true,
      "email": "your@email.com",
      "password": "**********",
      "devices": [
        {
          "name": "name",
          "ip": "x.x.x.x",
          "code": "xxxxxxxx",
          "tolerance": 5,
          "pollInterval": 20
        }
      ]
    }
  ]
 }
```
Multiple Slides can be added to the `devices` array. If you enable the `remote` setting and enter your credentials the plugin will add all your slides from the remote API.

Now start or restart homebridge and all slides should appear in the HomeKit app.
