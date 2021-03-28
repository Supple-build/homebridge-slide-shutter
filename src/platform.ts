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
import jwt from 'jsonwebtoken';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SlideLocalAccessory } from './localAccessory';

type slide = {
  device_name: string;
  id: number;
  device_id: string;
};

type device = {
  name: string;
  ip: string;
  id: number;
  deviceId: string;
  code: string;
  tolerance: number;
  pollInterval: number;
};

type parameters = {
  pos?: number;
  email?: string;
  password?: string;
};

export class SlidePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public accessToken;

  private devices;
  private remote;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.devices = this.config.devices || [];
    this.remote = this.config.remote || false;
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

    if (this.remote) {
      this.discoverRemoteDevices();
    }
  }

  async discoverRemoteDevices() {
    this.log.debug('Triggered discoverRemoteDevices');
    await this.getAccessToken();

    const response = await this.asyncRequest(
      null,
      'GET',
      'slides/overview',
      null,
      true,
    );

    if (response && response.slides) {
      const devices: device[] = [];
      response.slides.forEach((slide: slide) => {
        devices.push({
          name: slide['device_name'],
          id: slide['id'],
          deviceId: slide['device_id'],
          ip: null,
          code: null,
          pollInterval: null,
          tolerance: null,
        });
      });
      this.log.debug('==== devices', devices);
      this.registerDevices(devices);
    } else {
      this.log.info('No Slides found on your Slide account');
    }
  }

  async getAccessToken() {
    if (!this.accessToken || !jwt.verify(this.accessToken)) {
      const response = await this.login();
      this.accessToken = response['access_token'] || false;
    }

    return this.accessToken;
  }

  async login() {
    const parameters = {
      email: this.config['email'] || this.config['username'],
      password: this.config['password'],
    };
    return await this.asyncRequest(null, 'POST', 'auth/login', parameters);
  }

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
      this.log.error(error);
      return false;
    }
  }
}
