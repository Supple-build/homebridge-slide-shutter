import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import request from 'request-promise';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SlideLocalAccessory } from './localAccessory';

type device = {
  name: string;
  ip: string;
  code: string;
  tolerance: number;
  pollInterval: number;
};

type parameters = {
  pos: number;
};

export class SlidePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public accessToken;

  private devices;
  // private loginPromise;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.devices = this.config.devices || [];
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
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
    this.registerDevices(this.devices);
  }

  // discoverRemoteDevices() {
  //   this.getAccessToken()
  //     .then(() => {
  //       this.request(null, 'GET', 'slides/overview', null, true)
  //         .then((response: any) => {
  //           const slides = response.slides;
  //           if (slides) {
  //             const devices: any = [];
  //             slides.forEach((slideInfo: any) => {
  //               devices.push({
  //                 name: slideInfo['device_name'],
  //                 id: slideInfo['id'],
  //                 device_id: slideInfo['device_id'],
  //                 ip: null,
  //                 code: null,
  //               });
  //             });
  //             this.registerDevices(devices);
  //           }
  //         })
  //         .catch((error) => {
  //           this.log.error(error);
  //         });
  //     })
  //     .catch((error) => {
  //       this.log.error(error);
  //     });
  // }

  registerDevices(devices: device[]) {
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

        existingAccessory.context.device = device;

        new SlideLocalAccessory(this, existingAccessory, this.log);
      } else {
        this.log.info('Adding new accessory:', device.name);

        const accessory = new this.api.platformAccessory(device.name, uuid);

        accessory.context.device = device;

        new SlideLocalAccessory(this, accessory, this.log);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    }
  }

  // getAccessToken() {
  //   return new Promise((resolve, reject) => {
  //     if (this.accessToken) {
  //       this.log.debug('Already found access token');
  //       return resolve(this.accessToken);
  //     } else {
  //       this.log.debug('Needs access token to continue, returning login');
  //       this.login()
  //         .then((accessToken) => {
  //           resolve(accessToken);
  //         })
  //         .catch((error) => {
  //           reject(error);
  //         });
  //     }
  //   });
  // }

  // login() {
  //   if (this.loginPromise) {
  //     this.log.debug('Already logging in, returning existing promise');
  //     return this.loginPromise;
  //   }
  //   const parameters = {
  //     email: this.config['email'] || this.config['username'],
  //     password: this.config['password'],
  //   };
  //   const promise = new Promise((resolve, reject) => {
  //     this.request(null, 'POST', 'auth/login', parameters)
  //       .then((response: any) => {
  //         this.loginPromise = null;
  //         if (!response.access_token) {
  //           return reject(Error('Invalid response'));
  //         }
  //         this.accessToken = response.access_token;
  //         return resolve(response.access_token);
  //       })
  //       .catch((error) => {
  //         this.loginPromise = null;
  //         return reject(error);
  //       });
  //   });
  //   this.loginPromise = promise;
  //   return promise;
  // }

  async asyncRequest(
    device,
    method,
    endPoint,
    parameters: parameters | false = false,
    useToken = false,
  ) {
    this.log.debug('Triggered platform async request');

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

    try {
      const response = await request(requestInfo);
      return response;
    } catch (error) {
      this.log.error('asyncRequest error', error);
    }
  }
}
