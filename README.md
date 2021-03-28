
<p align="center">

<img src="https://github.com/bram-is/homebridge-slide-shutter/raw/main/_assets/header.png" width="286">

</p>

# Homebridge Slide Shutter

[![Downloads](https://img.shields.io/npm/dt/homebridge-slide-shutter)](https://www.npmjs.com/package/homebridge-slide-shutter)
[![Version](https://img.shields.io/npm/v/homebridge-slide-shutter)](https://www.npmjs.com/package/homebridge-slide-shutter)

[![GitHub issues](https://img.shields.io/github/issues/bram-is/homebridge-slide-shutter)](https://github.com/bram-is/homebridge-slide-shutter/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/bram-is/homebridge-slide-shutter)](https://github.com/bram-is/homebridge-slide-shutter/pulls)


Homebridge plugin for [Slide](https://nl.slide.store/) by Innovation in Motion.

This plugin supports the local and the remote API simultaneously. You can add local slides to the `devices` array. If you enable the `remote` setting and enter your credentials the plugin will add all your slides from the remote API.

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
