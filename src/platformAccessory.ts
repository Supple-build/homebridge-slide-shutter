import { Service, PlatformAccessory, Logger } from 'homebridge';

import poll from 'poll';

import { SlidePlatform } from './platform';

export class SlideAccesory {
  private service: Service;
  private readonly characteristic;

  private readonly name: string;
  private readonly ip: string;
  private readonly identifier: string | null;

  private isLikelyMoving: boolean;
  private calibrationTime: number;
  private tolerance: number;
  private pollInterval: number;

  constructor(
    private readonly platform: SlidePlatform,
    private readonly accessory: PlatformAccessory,
    public readonly log: Logger,
  ) {
    this.characteristic = this.platform.Characteristic;

    // extract data from config
    this.name = accessory.context.device.name;
    this.ip = accessory.context.device.ip;
    this.identifier = accessory.context.device.id || null;
    this.tolerance = accessory.context.device.tolerance || 7;
    this.calibrationTime = (accessory.context.device.closingTime || 20) * 1000; // 20 seconds
    this.pollInterval = accessory.context.device.pollInterval || 10;

    this.isLikelyMoving = false;

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Innovation in Motion',
      )
      .setCharacteristic(this.platform.Characteristic.Model, 'Slide');

    this.service =
      this.accessory.getService(this.platform.Service.WindowCovering) ||
      this.accessory.addService(this.platform.Service.WindowCovering);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.name,
    );

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .on('get', this.handleCurrentPositionGet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.PositionState)
      .on('get', this.handlePositionStateGet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetPosition)
      .on('get', this.handleTargetPositionGet.bind(this))
      .on('set', this.handleTargetPositionSet.bind(this));

    this.getSlideInfo().then((slideInfo: any) => {
      let position = this.slideAPIPositionToHomekit(
        slideInfo.pos || slideInfo.data.pos,
      );

      if (this.calculateDifference(position, 100) <= this.tolerance) {
        position = 100;
      } else if (this.calculateDifference(position, 0) <= this.tolerance) {
        position = 0;
      }
      this.service
        .getCharacteristic(this.characteristic.TargetPosition)
        .updateValue(position);

      this.service
        .getCharacteristic(this.characteristic.CurrentPosition)
        .updateValue(position);
    });

    poll(this.updateSlideInfo.bind(this), this.pollInterval * 1000);

    log.info('Slide Curtain finished initializing!');
  }

  /**
   * Calculates difference between two numbers
   * @param first number
   * @param second number
   * @returns number
   */
  calculateDifference(first, second) {
    let difference = first - second;
    if (difference < 0) {
      difference = difference * -1;
    }
    return difference;
  }

  /**
   * Converts HomeKit position to Slide API capable value
   * @param position number
   * @returns number
   */
  homekitPositionToSlideAPI(position) {
    let newPosition = 100 - position;
    newPosition = newPosition / 100;
    return Math.min(Math.max(newPosition, 0), 1);
  }

  /**
   * Converts slide position to HomeKit capable value
   * @param position number
   * @returns number
   */
  slideAPIPositionToHomekit(position) {
    let newPosition = position * 100;
    newPosition = 100 - newPosition;
    return Math.min(Math.max(newPosition, 0), 100);
  }

  getSlideInfo() {
    return this.platform.request(
      this.accessory.context.device,
      'GET',
      this.ip ? 'rpc/Slide.GetInfo' : `slide/${this.identifier}/info`,
      false,
      this.ip ? false : this.platform.accessToken,
    );
  }

  updateSlideInfo() {
    this.log.debug('Triggered update slide info from poll');
    this.getSlideInfo().then((slideInfo: any) => {
      let position = this.slideAPIPositionToHomekit(
        slideInfo.pos || slideInfo.data.pos,
      );

      let targetPosition;
      this.log.debug('likelyMoving', this.isLikelyMoving);

      this.calibrationTime =
        slideInfo['calib_time'] || slideInfo.data['calib_time'];

      if (!this.isLikelyMoving) {
        targetPosition = position;
        if (this.calculateDifference(position, 100) <= this.tolerance) {
          targetPosition = 100;
        } else if (this.calculateDifference(position, 0) <= this.tolerance) {
          targetPosition = 0;
        }
        this.service
          .getCharacteristic(this.characteristic.TargetPosition)
          .updateValue(targetPosition);
      }

      targetPosition = this.service.getCharacteristic(
        this.characteristic.TargetPosition,
      ).value;

      const difference = this.calculateDifference(targetPosition, position);
      this.log.debug(
        'Difference between position and target position: ' + difference,
      );
      this.log.debug('Current target position: ' + targetPosition);
      this.log.debug('Position from API: ' + position);

      if (difference <= this.tolerance) {
        position = targetPosition;
      }

      this.service
        .getCharacteristic(this.characteristic.CurrentPosition)
        .updateValue(position);

      if (targetPosition === position) {
        this.service
          .getCharacteristic(this.characteristic.PositionState)
          .updateValue(this.characteristic.PositionState.STOPPED);
        // We have stopped so set the likely moving to false
        this.isLikelyMoving = false;
      } else if (targetPosition < position) {
        this.service
          .getCharacteristic(this.characteristic.PositionState)
          .updateValue(this.characteristic.PositionState.DECREASING);
      } else {
        this.service
          .getCharacteristic(this.characteristic.PositionState)
          .updateValue(this.characteristic.PositionState.INCREASING);
      }
    });
  }

  handleCurrentPositionGet(callback) {
    this.log.debug('Triggered GET CurrentPosition');
    this.getSlideInfo()
      .then((slideInfo: any) => {
        let position = this.slideAPIPositionToHomekit(
          slideInfo.pos || slideInfo.data.pos,
        );
        let targetPosition;

        if (!this.isLikelyMoving) {
          targetPosition = position;
          if (this.calculateDifference(position, 100) <= this.tolerance) {
            targetPosition = 100;
          } else if (this.calculateDifference(position, 0) <= this.tolerance) {
            targetPosition = 0;
          }
          this.service
            .getCharacteristic(this.characteristic.TargetPosition)
            .updateValue(targetPosition);
        }
        targetPosition = this.service.getCharacteristic(
          this.characteristic.TargetPosition,
        ).value;

        const difference = this.calculateDifference(targetPosition, position);
        if (difference <= this.tolerance) {
          position = targetPosition;
        }
        this.service
          .getCharacteristic(this.characteristic.CurrentPosition)
          .updateValue(position);

        callback(null, position);
      })
      .catch((error) => {
        callback(error);
      });
  }

  handleTargetPositionGet(callback) {
    this.log.debug('Triggered GET TargetPosition');
    this.getSlideInfo()
      .then((slideInfo: any) => {
        let position = this.slideAPIPositionToHomekit(
          slideInfo.pos || slideInfo.data.pos,
        );

        if (this.calculateDifference(position, 100) <= this.tolerance) {
          position = 100;
        } else if (this.calculateDifference(position, 0) <= this.tolerance) {
          position = 0;
        }
        callback(null, position);
      })
      .catch((error) => {
        callback(error);
      });
  }

  handleTargetPositionSet(targetPosition, callback) {
    this.log.debug('Triggered SET TargetPosition:' + targetPosition);

    const setPos = this.homekitPositionToSlideAPI(targetPosition);

    this.platform
      .request(
        this.accessory.context.device,
        'POST',
        this.ip ? 'rpc/Slide.SetPos' : `slide/${this.identifier}/position`,
        {
          pos: setPos,
        },
        this.ip ? false : this.platform.accessToken,
      )
      .then(() => {
        const currentPosition =
          this.service.getCharacteristic(this.characteristic.CurrentPosition)
            .value || targetPosition;
        if (targetPosition === currentPosition) {
          this.service
            .getCharacteristic(this.characteristic.PositionState)
            .updateValue(this.characteristic.PositionState.STOPPED);
        } else if (targetPosition < currentPosition) {
          this.service
            .getCharacteristic(this.characteristic.PositionState)
            .updateValue(this.characteristic.PositionState.DECREASING);
        } else {
          this.service
            .getCharacteristic(this.characteristic.PositionState)
            .updateValue(this.characteristic.PositionState.INCREASING);
        }
        this.service
          .getCharacteristic(this.characteristic.TargetPosition)
          .updateValue(targetPosition);
        this.isLikelyMoving = true;
        setTimeout(() => {
          this.log.debug('Stopping the move from time-out');
          this.isLikelyMoving = false;
        }, this.calibrationTime + 1000);
        poll(this.updateSlideInfo.bind(this), 3000, () => {
          if (!this.isLikelyMoving) {
            this.log.debug('Stopping the increased poll rate');
          }
          return !this.isLikelyMoving;
        });
        callback(null, targetPosition);
      });
  }

  handlePositionStateGet(callback) {
    this.log.debug('Triggered GET PositionState');
    callback(
      null,
      this.service.getCharacteristic(this.characteristic.PositionState).value,
    );
  }
}
