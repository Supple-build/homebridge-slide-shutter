
<p align="center">

<img src="https://github.com/bram-is/homebridge-slide-shutter/raw/main/_assets/header.png" width="286">

</p>

# Homebridge Slide Shutter

[![Downloads](https://img.shields.io/npm/dt/homebridge-slide-shutter)](https://www.npmjs.com/package/homebridge-slide-shutter)
[![Version](https://img.shields.io/npm/v/homebridge-slide-shutter)](https://www.npmjs.com/package/homebridge-slide-shutter)

[![GitHub issues](https://img.shields.io/github/issues/bramsmulders/homebridge-slide-shutter)](https://github.com/bramsmulders/homebridge-slide-shutter/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/bramsmulders/homebridge-slide-shutter)](https://github.com/bramsmulders/homebridge-slide-shutter/pulls)


Homebridge plugin for [Slide](https://nl.slide.store/) by Innovation in Motion.

Currently this plugin only supports the latest local API. In the future it will also be able to control curtains with the remote API.

## Installation

You can search in the HomeBridge `Plugins` tab for `homebridge-slide-shutter`. Follow instructions on screen to configure your slides.

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
      "name": "slide-shutter", #OPTIONAL. Your desired display name for in the homebridge logs.
      "devices": [
        {
          "name": "name", #REQUIRED. Your desired display name for in HomeKit.
          "ip": "x.x.x.x", #REQUIRED. IP for your Slide on your router. Should be a fixed IP address.
          "code": "xxxxxxxx", #REQUIRED. Code with 8 characters from the sticker on the top of your Slide or in the manual.
          "tolerance": x, #OPTIONAL. Threshold in % to still consider state fully open or fully closed. Defaults to 10.
          "pollInterval": x #OPTIONAL. Time in seconds to poll the Slide curtain. Defaults to 5.
        }
      ]
    }
  ]
 }
```
Multiple Slides can be added to the `devices` array.

Now start of restart homebridge and all slides should appear in the HomeKit app.

# Roadmap

- [ ] Cleanup code and use `async` & `await` instead of promises.
- [ ] Make the remote API work as well.
- [ ] Correctly report errors by marking the accessory as "Not responding" in the Home app.
