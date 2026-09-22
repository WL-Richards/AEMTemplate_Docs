---
sidebar_position: 1
title: CAN Device ID
---

# CAN Device ID

`CANDeviceID` describes one device on a CAN bus: its numeric ID, which bus it is on, what kind of device it is, and what it is called. Every motor controller, encoder, gyro, and range sensor in the library is identified by one of these, and it is how logs and error messages refer to hardware by name instead of by number.

```java
import com.aembot.lib.core.can.CANDeviceID;
import com.aembot.lib.core.can.CANDeviceID.CANDeviceType;
```

A `CANDeviceID` does not create or own any hardware. It is a plain description that the factories and IO classes read when they build the real device.

## Constructors

| Constructor                                                                                                 | Bus                      |
| ----------------------------------------------------------------------------------------------------------- | ------------------------ |
| `CANDeviceID(int canID, String deviceName, String subsystemName, CANDeviceType deviceType)`                 | `"rio"`                  |
| `CANDeviceID(int canID, String deviceName, String subsystemName, CANDeviceType deviceType, String busName)` | Named bus by string      |
| `CANDeviceID(int canID, String deviceName, String subsystemName, CANDeviceType deviceType, CANBus bus)`     | Existing `CANBus` object |

The four argument form is the common one. Use the five argument form with a string for anything on a CANivore.

```java
new CANDeviceID(54, "FlywheelMotor", "FlywheelSubsystem", CANDeviceType.TALON_FX) // on rio
new CANDeviceID(1, "FLDrive", "DriveSubsystem", CANDeviceType.TALON_FX, "Clyde") // on a CANivore named Clyde
```

## Device types

`CANDeviceType` is a nested enum. Its `toString()` returns the display name in the second column, which is what shows up in log paths.

| Value      | Display name |
| ---------- | ------------ |
| `TALON_FX` | `TalonFX`    |
| `CANCODER` | `CANcoder`   |
| `CANRANGE` | `CANRange`   |
| `PIGEON2`  | `Pigeon2`    |

## Getters

| Method               | Returns                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `getDeviceID()`      | The CAN ID as an `int`.                                                           |
| `getBus()`           | The `CANBus` object.                                                              |
| `getBusName()`       | The bus name as a string.                                                         |
| `getDeviceType()`    | The `CANDeviceType`.                                                              |
| `getDeviceName()`    | The given name with the ID appended, for example `FlywheelMotor_54`.              |
| `getSubsystemName()` | The subsystem name given at construction.                                         |
| `toString()`         | `getDeviceName()` with the bus name appended, for example `FlywheelMotor_54_rio`. |

:::info
`getDeviceName()` does not return the name you passed in. It returns `name_ID`. This is deliberate, so that two devices given the same name but different IDs still produce distinct log paths.
:::

`equals(CANDeviceID other)` compares CAN ID, bus, and device type. The name is not part of equality. Two devices with the same ID and type on the same bus are the same device regardless of what they were called.

## Connection status

A `CANDeviceID` can carry a Phoenix 6 `StatusSignal` that is used only to tell whether the device is alive. The value of the signal does not matter. What matters is whether it is being received.

| Method                                               | Description                                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `setStatusSignal(StatusSignal<?> signal)`            | Store a signal to check.                                                                                                    |
| `setStatusSignal(StatusSignal<?> signal, double hz)` | Store a signal and set its update frequency in Hz.                                                                          |
| `getCTREStatusSignal()`                              | The stored signal, or `null` if none was set.                                                                               |
| `isConnected()`                                      | `true` if a signal is set and its last status is `StatusCode.OK`. `false` otherwise, including when no signal was ever set. |

`TalonFXFactory` sets the supply voltage signal at 100 Hz on every motor it creates, so motors get this behavior for free. Devices created some other way have to call `setStatusSignal` themselves or `isConnected()` will always report `false`.

:::warning
`isConnected()` reads the status from the last refresh. It does not refresh the signal itself. Something has to call `refresh()` or `BaseStatusSignal.refreshAll()` first, or the answer is stale. `CANStatusLogger` does this before it checks.
:::

## Master device

A follower motor can record which device it follows.

| Method                                   | Description                                             |
| ---------------------------------------- | ------------------------------------------------------- |
| `setMasterCANDevice(CANDeviceID master)` | Record that this device follows `master`.               |
| `getMasterDevice()`                      | The master device, or `null` if this is not a follower. |

`MotorIOTalonFX.follow()` sets this automatically. It exists so that `CANStatusLogger` can log a `Following` entry next to the follower's connection state.

## CANStatusLogger

`CANStatusLogger` logs bus utilization and the connection state of every registered device. There is one instance per bus name, created on demand.

```java
import com.aembot.lib.core.can.CANStatusLogger;
```

| Method                                                                                          | Description                                                                                                                       |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `CANStatusLogger.get(String busName)`                                                           | Static. Returns the logger for that bus, creating it on first call.                                                               |
| `CANStatusLogger.updateAllLogs()`                                                               | Static. Logs every bus and device. Does nothing unless the robot is disabled.                                                     |
| `registerCANDevice(CANDeviceID device)`                                                         | Add a device to this bus's logger.                                                                                                |
| `registerSwerveDrivetrain(SwerveDrivetrain, List<SwerveModuleConfiguration>, CANDeviceID gyro)` | Register every module motor, encoder, and the gyro from a CTRE swerve drivetrain, setting their supply voltage signals at 100 Hz. |
| `getBusName()`                                                                                  | The bus this logger covers.                                                                                                       |

`TalonFXFactory` registers every motor it creates, so ordinary mechanisms do not call `registerCANDevice` directly. `Robot.java` calls `updateAllLogs()` once per loop.

Each update writes the following outputs.

| Log path                                                    | Value                                  |
| ----------------------------------------------------------- | -------------------------------------- |
| `CANStatus/<bus>/BusStatus`                                 | CTRE bus status code                   |
| `CANStatus/<bus>/BusUtilization`                            | Fraction of bus bandwidth in use       |
| `CANStatus/<bus>/<subsystem>/<type>/<deviceName>`           | `true` if connected                    |
| `CANStatus/<bus>/<subsystem>/<type>/<deviceName>/Following` | Master device name, only for followers |

:::info
Connection state is only logged while the robot is disabled. `updateAllLogs()` returns immediately while enabled so that refreshing every status signal on every bus does not add CAN traffic during a match. Check for a missing device before enabling, not after.
:::

## Where it is used

Every `MotorConfiguration` carries one in `kCANDevice`. `TalonFXFactory.createRawWithConfig` reads it to build the `TalonFX`, then attaches a status signal and registers it. Swerve module and sensor configurations hold one per device in the same way.
