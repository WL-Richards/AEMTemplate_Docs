---
sidebar_position: 1
title: Creating a Robot Definition
---

# Creating a Robot Definition

The library supports running the same codebase on more than one physical robot. Each robot is identified by the MAC address of its roboRIO, and the identity is used to select a `RobotConfiguration` at startup. This guide adds a second robot named "Practice" alongside the existing production bot.

All paths below are relative to the season package, `com.aembot.frcXXXX`, where `XXXX` is the current game year.

## How identification works

At boot, `RobotIDYearly.getIdentification()`, the season's implementation of [`RobotID`](../../reference/config/robot-id), reads the MAC address of the roboRIO and looks it up in a map of known addresses. The result is stored in `RobotRuntimeConstants.ROBOT_ID`, and the matching configuration is stored in `RobotRuntimeConstants.ROBOT_CONFIG`. Both are described on the [Runtime Constants](../../reference/logging/runtime-constants) page. Every subsystem factory reads from `ROBOT_CONFIG`, so nothing else in the code needs to know which robot it is running on.

If the MAC address is not in the map, the default robot is used. In simulation there is no roboRIO, so the default is always selected.

:::info
The MAC address the library read at boot is recorded in every log file. Open any log from the robot in AdvantageScope and look for `MACAddress` on the Metadata tab. If there is no log yet, the roboRIO web dashboard at `http://roborio-6443-frc.local` shows it under network settings, or SSH in and run `ifconfig`. The address the library reads is the first interface with a hardware address, which is normally the Ethernet port.
:::

## What a robot configuration is

`RobotConfiguration` is an abstract class in the season package, not in the library. It has one abstract getter per mechanism on that year's robot, and each getter returns a library configuration object for that mechanism. The version in the [2026 season code](https://github.com/AEMBOT/FRC_2026) looks roughly like this. The template ships with only the drivetrain, camera, name, and bus getters, since those are the ones every robot has.

```java
public abstract class RobotConfiguration {
  public abstract String getRobotName();
  public abstract List<String> getCANBusNames();

  public abstract DrivetrainConfiguration getDrivetrainConfiguration();
  public abstract List<SwerveModuleConfiguration<...>> getSwerveConfigurations();
  public abstract DrivetrainSimConfiguration getSimulatedDrivetrainConfiguration();

  public abstract TalonFXFlywheelConfiguration getFlywheelConfiguration();
  public abstract TalonFXHoodConfiguration getHoodConfig();
  public abstract TalonFXTurretConfiguration getTurretConfig();
  public abstract TalonFXOverBumperIntakeDeployConfiguration getIntakeDeployConfig();
  // ...one getter per mechanism

  public static RobotConfiguration getRobotConstants(RobotIDYearly identification) { ... }
}
```

The getters are the contract between the season code and the library. A subsystem factory calls `ROBOT_CONFIG.getFlywheelConfiguration()` and hands the result to `FlywheelSubsystem`, which is a library class. The factory does not care which robot the config came from, only that every robot can answer the question.

Because the list of mechanisms is different every game, this class is rewritten every season. A robot with no turret has no `getTurretConfig()`. A robot with two intakes has two intake getters. When a mechanism is added mid-season, a new abstract getter is added here, and every concrete robot class stops compiling until it implements it. That is the point: it is not possible to deploy a robot that is missing a piece of its description.

The return types are what tie the season to the library. [`TalonFXFlywheelConfiguration`](../../reference/config/flywheel-configuration) lives in `com.aembot.lib` and has not changed between seasons. The season code decides that this year's robot has a flywheel, and the library decides what a flywheel needs to know about itself.

Not every getter returns a library class. Mechanisms that only exist for one game, such as the 2026 turret, have their configuration and subsystem in the season package alongside `RobotConfiguration`. The getter looks the same either way. The difference is whether the class it returns is expected to survive into next year.

:::info
The drivetrain getters, robot name, and CAN bus list have been the same every year so far. Everything else on the class should be expected to change.
:::

## Add the ID

Open `frcXXXX/config/RobotIDYearly.java` and add a new enum constant. The string is the human readable name that shows up in logs.

```java
public enum RobotIDYearly implements RobotID {
  PRODUCTION("Production Bot"),
  PRACTICE("Practice Bot"),
  ;
```

Further down in the same file, add the MAC address to the lookup map.

```java
private static final Map<String, RobotID> ROBOT_TO_MAC =
    Map.of(
        "00:80:2f:aa:bb:cc", RobotIDYearly.PRODUCTION,
        "00:80:2f:dd:ee:ff", RobotIDYearly.PRACTICE);
```

`DEFAULT_ROBOT` can stay as is unless the practice bot should be the fallback.

## Create the configuration

Every robot needs a class that extends `RobotConfiguration` and implements every getter. The easiest way to start is to copy `frcXXXX/config/robots/ProductionConfig.java` to `PracticeConfig.java` in the same package and rename the class.

`ProductionConfig` does not hold any numbers itself. It delegates to one helper class per mechanism, such as `ProductionDrivetrainConfig` in the template or `ProductionFlywheelConfig` in the [2026 season code](https://github.com/AEMBOT/FRC_2026), and returns the objects those classes build. When the practice bot shares a mechanism with the production bot, keep pointing at the production helper. When it differs, copy the helper and edit the copy.

For example, if the practice bot has a different flywheel motor ID and gear ratio, copy `ProductionFlywheelConfig` to `PracticeFlywheelConfig`, change the constants at the top of the file, and update the field in `PracticeConfig`.

```java
public class PracticeConfig extends RobotConfiguration {
  private static final String ROBOT_NAME = "Practice";

  // Shared with production
  private static final ProductionHoodConfig HOOD_CONFIG = new ProductionHoodConfig();

  // Practice specific
  private static final PracticeFlywheelConfig FLYWHEEL_CONFIG = new PracticeFlywheelConfig();

  @Override
  public String getRobotName() {
    return ROBOT_NAME;
  }

  @Override
  public TalonFXFlywheelConfiguration getFlywheelConfiguration() {
    return FLYWHEEL_CONFIG.CONFIG;
  }

  // ...remaining getters
}
```

:::tip
CAN bus names and the robot's physical dimensions, held in a [`PhysicalConfiguration`](../../reference/config/physical-configuration), are also part of the configuration. If the practice bot has its drivetrain on the rio bus instead of a CANivore, change `DRIVETRAIN_BUS_NAME` in the new config rather than editing the drivetrain helper.
:::

## Register it

The last step is to tell `RobotConfiguration.getRobotConstants()` about the new class. This is a plain switch on the enum.

```java
public static RobotConfiguration getRobotConstants(RobotIDYearly identification) {
  switch (identification) {
    case PRACTICE:
      return new PracticeConfig();
    case PRODUCTION:
    default:
      return new ProductionConfig();
  }
}
```

Deploy to the practice bot. The name of the selected robot is recorded as `RobotName` in the log metadata, so open the log in AdvantageScope and check the Metadata tab before trusting the deploy. If it says "Production Bot", the MAC address in the map does not match.

## Checking in simulation

Simulation always uses the default robot. To simulate a different robot, temporarily change `DEFAULT_ROBOT` in `RobotIDYearly`, then change it back before committing.
