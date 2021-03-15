import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import request from 'request';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SlideAccesory } from './platformAccessory';

export class SlidePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public accessToken;

  private mode;
  private devices;
  private loginPromise;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.mode = this.config.mode || 'local';
    this.devices = this.config.devices || [];
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  discoverDevices() {
    if (this.mode === 'local') {
      this.registerDevices(this.devices);
    } else {
      this.discoverRemoteDevices();
    }
  }

  discoverRemoteDevices() {
    this.getAccessToken().then(() => {
      this.request(null, 'GET', 'slides/overview', null, true).then(
        (response: any) => {
          const slides = response.slides;
          if (slides) {
            const devices: any = [];
            slides.forEach((slideInfo: any) => {
              devices.push({
                name: slideInfo['device_name'],
                id: slideInfo['id'],
                device_id: slideInfo['device_id'],
                ip: null,
                code: null,
              });
            });
            this.registerDevices(devices);
          }
        },
      );
    });
  }

  registerDevices(devices: any) {
    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(
        `${device.code || device['device_id']}`,
      );

      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid,
      );

      if (existingAccessory) {
        this.log.info(
          'Restoring existing accessory from cache:',
          existingAccessory.displayName,
        );

        new SlideAccesory(this, existingAccessory, this.log);
      } else {
        this.log.info('Adding new accessory:', device.name);

        const accessory = new this.api.platformAccessory(device.name, uuid);

        accessory.context.device = device;

        new SlideAccesory(this, accessory, this.log);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    }
  }

  getAccessToken() {
    return new Promise((resolve, reject) => {
      if (this.accessToken) {
        this.log.debug('Already found access token');
        return resolve(this.accessToken);
      } else {
        this.log.debug('Needs access token to continue, returning login');
        this.login()
          .then((accessToken) => {
            resolve(accessToken);
          })
          .catch((error) => {
            reject(error);
          });
      }
    });
  }

  login() {
    if (this.loginPromise) {
      this.log.debug('Already logging in, returning existing promise');
      return this.loginPromise;
    }
    const parameters = {
      email: this.config['email'] || this.config['username'],
      password: this.config['password'],
    };
    const promise = new Promise((resolve, reject) => {
      this.request(null, 'POST', 'auth/login', parameters)
        .then((response: any) => {
          this.loginPromise = null;
          if (!response.access_token) {
            return reject(Error('Invalid response'));
          }
          this.accessToken = response.access_token;
          return resolve(response.access_token);
        })
        .catch((error) => {
          this.loginPromise = null;
          return reject(error);
        });
    });
    this.loginPromise = promise;
    return promise;
  }

  request(
    device,
    method,
    endPoint,
    parameters: any | false = false,
    useToken = false,
  ) {
    if (endPoint.length > 0 && endPoint.charAt(0) !== '/') {
      endPoint = '/' + endPoint;
    }

    const baseURL =
      device && device.ip
        ? `http://${device.ip}`
        : 'https://api.goslide.io/api';

    const addParameters = method === 'POST' && parameters;
    const authUsingCode = !useToken && device && device.code;

    const requestInfo = {
      uri: baseURL + endPoint,
      method: method,
      timeout: 6000,
      headers: {
        'User-Agent': 'homebridge-slide-link',
      },
      json: true,
      ...(useToken && {
        auth: {
          bearer: this.accessToken,
          sendImmediately: true,
        },
      }),
      ...(authUsingCode && {
        auth: {
          username: 'user',
          password: device.code,
          sendImmediately: false,
        },
      }),
      ...(addParameters && {
        body: parameters,
      }),
    };

    return new Promise((resolve, reject) => {
      request(requestInfo, (error, response, responseBody) => {
        if (error) {
          this.log.error(error);
          return reject(error);
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          error = Error('Invalid response received: ' + response.statusCode);
          this.log.error(error);
          return reject(error);
        }
        return resolve(responseBody);
      });
    });
  }
}
