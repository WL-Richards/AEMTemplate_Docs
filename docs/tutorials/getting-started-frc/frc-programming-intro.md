---
sidebar_position: 1
title: FRC Programming Introduction
---

# FRC Programming Introduction

Robot code is a Java program that runs on a small computer inside the robot, reads sensors, and drives motors. This page covers what that program is, what it runs on, and the hardware it talks to. Later pages cover how the code is organized.

## The roboRIO

The roboRIO is the robot's computer. It runs Linux, has a network connection to the driver's laptop, and has a handful of ports for wiring things directly. Code is deployed to it from a laptop, and once deployed it starts automatically every time the robot is powered on.

The roboRIO is not fast. The current model is the roboRIO 2.0.

| Spec      | roboRIO 2.0                        |
| --------- | ---------------------------------- |
| Processor | Dual core ARM Cortex-A9 at 866 MHz |
| RAM       | 512 MB                             |

Robot code has to be light, and anything heavy like vision processing runs on a separate device.

## The Driver Station

The Driver Station is a program on the driver's laptop. It connects to the roboRIO over WiFi, passes controller inputs through, and tells the robot which mode it is in. At a competition the field's own system drives the Driver Station, and the robot cannot be enabled without it.

The robot is always in one of a few modes.

| Mode         | What is happening                                                            |
| ------------ | ---------------------------------------------------------------------------- |
| Disabled     | Code runs, sensors are read, but motors cannot move. This is the safe state. |
| Autonomous   | First 15 seconds of a match. The robot runs on its own with no driver input. |
| Teleoperated | The rest of the match. Drivers control the robot.                            |
| Test         | For running checks in the pit. Rarely used.                                  |

Code can ask which mode it is in and which alliance color it is on, and both are used constantly.

## The robot loop

Robot code does not run top to bottom once. It runs in a loop, 50 times a second. Every 20 milliseconds, WPILib calls into the code, the code reads every sensor, decides what each motor should do, sends those outputs, and returns. Then it waits for the next tick.

This shapes everything about how the code is written. Nothing may block. A loop that waits for a sensor to change would stall the whole robot, so instead the code checks the sensor once per tick and moves on. Anything that takes time, like driving to a position, is broken into a check that happens each tick until it is done.

:::info
Missing the 20 millisecond deadline is called a loop overrun. The Driver Station prints a warning when it happens. Occasional overruns are harmless. Constant overruns mean something in the loop is too slow and the robot will feel laggy.
:::

## WPILib

WPILib is the library FIRST provides for writing robot code. It handles the loop, the Driver Station connection, controller input, math for geometry and kinematics, and simulation. Every FRC Java program is built on it. Its [documentation](https://docs.wpilib.org) is the reference for anything not specific to this team.

WPILib also provides a way to organize code called command-based, which this codebase uses throughout. It has its own [page](./command-based-programming).

Two other libraries matter here. Phoenix 6 is the vendor library for the motor controllers and sensors the team uses. AdvantageKit adds logging and replay, and is covered on the [IO Layers and Logging](./io-layers-and-logging) page.

## CAN

Almost nothing on the robot is wired directly to the roboRIO. Motor controllers and sensors are connected to a two wire network called CAN that runs around the robot. Each device has a numeric ID, and the roboRIO sends commands to an ID and receives sensor readings back from it.

Every device on a bus needs a unique ID. Two devices with the same ID will fight and the symptoms are confusing. The IDs for each robot live in its configuration classes.

```java
new CANDeviceID(54, "FlywheelMotor", "FlywheelSubsystem", CANDeviceType.TALON_FX)
```

The library wraps an ID in a [`CANDeviceID`](../../reference/core/can-device-id) that also carries a name and subsystem, so logs say "FlywheelMotor_54" instead of just a number.

The roboRIO's built in CAN bus is named `rio` and has limited bandwidth. A swerve drivetrain alone can fill it, so the drivetrain is put on a second bus provided by a USB device called a CANivore.

## Motors

A brushless motor needs a motor controller to drive it. The controller switches power to the motor windings in the right sequence and reads the motor's built in encoder, which reports how far the shaft has turned. The motor and the controller are separate ideas even when they arrive as one part.

The team uses **Kraken X60** motors. The controller built into a Kraken is a **TalonFX**, and that is the name used in code. Older Falcon 500 motors also contain a TalonFX and use the same code.

```java
TalonFX motor = new TalonFX(54, "rio");
```

A TalonFX has settings stored on it: which direction is positive, whether it holds position or spins freely when told to stop, how much current it may draw, and constants for closed loop control. Out of the box those settings are whatever the device shipped with or whatever the last person to use it set, and none of them are correct for a mechanism by accident. Applying a configuration is how the code takes control of them.

Every time the robot boots, the code builds a `TalonFXConfiguration` object describing every setting it cares about and writes the whole thing to the device. The device stores the settings in its own memory, so once the write succeeds they stay in effect until something overwrites them. The write goes over CAN and can fail if the bus is busy or the device is still powering up, so the library's [TalonFX Factory](../../reference/core/talonfx-factory) retries it until the device acknowledges it. A configuration that silently fails to apply leaves a motor running with someone else's settings, which is one of the harder problems to notice.

```java
TalonFXConfiguration config =
    new TalonFXConfiguration()
        .withMotorOutput(new MotorOutputConfigs().withNeutralMode(NeutralModeValue.Brake))
        .withCurrentLimits(new CurrentLimitsConfigs().withSupplyCurrentLimit(40));

motor.getConfigurator().apply(config);
```

That is the raw Phoenix 6 call. In this codebase it is never written by hand. The configuration object is built in the robot's configuration files, and the library applies it when the motor is created. The [Creating a Subsystem](../getting-started-aemlib/creating-a-subsystem#the-hardware-io) page walks through exactly what happens at that point.

:::tip
Phoenix Tuner, CTRE's desktop tool, can read the live settings off any device on the bus. When a motor is behaving strangely, comparing what Tuner shows against what the configuration file says is the fastest way to tell whether the config actually applied.
:::

Once configured, the TalonFX is told what to do by sending it a request. The simplest is a voltage. More useful ones are a target velocity or a target position, and the controller then runs its own control loop to hold the target without the roboRIO's involvement.

That loop runs on the TalonFX at 1 kHz, twenty times faster than the robot loop. This is the main reason closed loop control is done on the device rather than in robot code. A loop on the roboRIO could only correct the motor every 20 milliseconds and would have to wait for sensor data to cross the CAN bus first. The TalonFX reads its own encoder and adjusts its own output every millisecond, and the roboRIO only has to tell it where to go. Choosing the right request and tuning the constants for it is most of what mechanism control is about, and the library hides the details behind a set of commands on each subsystem.

:::info
The TalonFX measures everything in rotations of the motor shaft. Turning that into degrees of an arm or meters per second of a flywheel is a matter of multiplying by a ratio, and the library's [motor configuration](../../reference/config/motor-configuration) is where that ratio is set.
:::

## Sensors

A few CAN sensors show up alongside the motors.

**CANcoder** is an absolute encoder. It reports the angle of a shaft and remembers it through power cycles, which a motor's built in encoder does not. Each swerve module has one on its steering shaft so the code knows which way the wheel points at boot.

**Pigeon 2** is a gyro. It reports which way the robot is facing, and the drivetrain uses it for field relative driving and tracking position.

**CANrange** is a distance sensor. It is used to detect whether a game piece is in the robot.

Each of these gets a `CANDeviceID` and a configuration object the same way a motor does. The [Sensor Configuration](../../reference/config/sensor-configuration) and [Drivetrain Configuration](../../reference/config/drivetrain-configuration) pages list them.

## Where to look

`ProductionSwerveModuleConfigs` in `frcXXXX/config/robots` shows a full `TalonFXConfiguration` for a drive motor and a steer motor, plus a CANcoder. `MotorIOTalonFX` in `lib/core/motors/io` is where the library actually talks to a TalonFX, and is worth skimming once the [IO Layers and Logging](./io-layers-and-logging) page makes sense.
