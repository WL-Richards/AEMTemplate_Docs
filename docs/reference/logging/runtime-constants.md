---
sidebar_position: 2
title: Runtime Constants
---

# Runtime Constants

`RuntimeConstants` holds the values that are decided once at boot and never change: which mode the code is running in and which robot it is running on. The season package extends it to add its own.

```java
import com.aembot.lib.constants.RuntimeConstants;
import com.aembot.lib.constants.RuntimeConstants.RuntimeMode;
```

## RuntimeMode

An enum with three values. Almost every factory in the codebase switches on it.

| Value    | When                                                      |
| -------- | --------------------------------------------------------- |
| `REAL`   | Running on a roboRIO.                                     |
| `SIM`    | Running on a desktop with no log to replay.               |
| `REPLAY` | Running on a desktop with a log file as the input source. |

## RuntimeConstants

| Field or method    | Value                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| `MODE`             | `RuntimeMode.REAL` if `RobotBase.isReal()`, otherwise `RuntimeMode.SIM`. |
| `ROBOT_ID`         | The `RobotID` for this robot. See below.                                 |
| `isRedAlliance()`  | `true` only if the Driver Station has assigned red.                      |
| `isBlueAlliance()` | `true` only if the Driver Station has assigned blue.                     |

Both alliance methods return `false` before the Driver Station connects. Code that needs an alliance should treat neither being true as "not yet known" rather than defaulting to one.

:::info
`MODE` never evaluates to `REPLAY` in the library. It only distinguishes real from not real. The season's `RobotRuntimeConstants` is where replay would be selected, and today it inherits `MODE` unchanged. The `REPLAY` branches in the factories and in `Loggerable` are reachable only if that is changed.
:::

### The ROBOT_ID indirection

`ROBOT_ID` is declared in the library but assigned from the season package.

```java
public static final RobotID ROBOT_ID = RobotRuntimeConstants.ROBOT_ID;
```

The comment in the source calls this "maybe wierd and cursed" and asks for review. It is a circular dependency: `lib` imports `frc2026`, which imports `lib`. Java tolerates it because static initialization is lazy, but it means the library is not actually independent of the season code. The intent is to give library classes like `Loggerable` one place to read the robot identity without knowing which season they are in. A cleaner design would have the season register the ID into the library at startup rather than the library reaching into the season package.

## RobotRuntimeConstants

The season class extends `RuntimeConstants` and adds the robot configuration.

| Field          | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| `ROBOT_ID`     | `RobotIDYearly.getIdentification()`, cast to `RobotIDYearly`. |
| `ROBOT_CONFIG` | `RobotConfiguration.getRobotConstants(ROBOT_ID)`.             |

`ROBOT_CONFIG` is what every subsystem factory reads. See [Creating a Robot Definition](../../tutorials/getting-started-aemlib/creating-a-robot-definition) for how the ID is resolved.

## BuildConstants

`BuildConstants` under `lib/constants/generated` is written by the Gradle `gversion` plugin on every build. Do not edit it. It is read by `Loggerable.setupMetadata`.

| Field             | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `MAVEN_NAME`      | Project name.                                          |
| `VERSION`         | Project version. `"unspecified"` unless set in Gradle. |
| `GIT_REVISION`    | Commit count.                                          |
| `GIT_SHA`         | Full commit hash.                                      |
| `GIT_DATE`        | Commit timestamp.                                      |
| `GIT_BRANCH`      | Branch name.                                           |
| `BUILD_DATE`      | Build timestamp.                                       |
| `BUILD_UNIX_TIME` | Build timestamp in milliseconds.                       |
| `DIRTY`           | `0` clean, `1` uncommitted changes.                    |

## FieldConstants

Year agnostic field values. Only AprilTag dimensions live here.

| Field                     | Value                  |
| ------------------------- | ---------------------- |
| `APRIL_TAG_HEIGHT_METERS` | 6.5 inches, in meters. |
| `APRIL_TAG_WIDTH_METERS`  | 6.5 inches, in meters. |

## RobotStateConstants

Tuning for the state buffers.

| Field                             | Value | Description                                                         |
| --------------------------------- | ----- | ------------------------------------------------------------------- |
| `Kinematics.BUFFER_WINDOW_LENGTH` | `1.0` | Seconds of history each `ConcurrentTimeInterpolatableBuffer` keeps. |

## YearFieldConstantable

An interface a season's field class implements to expose the AprilTag layout. `Field2026` is the current implementation.

| Method                      | Description                                                                 |
| --------------------------- | --------------------------------------------------------------------------- |
| `getFieldLayout()`          | Abstract. The WPILib `AprilTagFieldLayout` for the year.                    |
| `getNumTags()`              | Number of tags in the layout.                                               |
| `getAprilTagPose3d(int id)` | Pose of a tag. Throws `IllegalArgumentException` if the ID is out of range. |
| `getAprilTagPose2d(int id)` | The same pose flattened to 2D.                                              |

:::info
The range check in `getAprilTagPose3d` rejects negative IDs and IDs above the tag count, but lets ID `0` through. Tag IDs start at 1, so `0` reaches the layout lookup and throws a `RuntimeException` from there instead.
:::
