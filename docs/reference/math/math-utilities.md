---
sidebar_position: 1
title: Math Utilities
---

# Math Utilities

The classes under `com.aembot.lib.math`. Each is independent of the others.

## PositionUtil

`PositionUtil` is a static class for converting between WPILib pose and transform types and for flipping field positions by alliance.

```java
import com.aembot.lib.math.PositionUtil;
```

### Conversions

WPILib treats a `Pose` and a `Transform` as different things even though both are a translation plus a rotation. These methods move between them without arithmetic.

| Method                  | Returns                                               |
| ----------------------- | ----------------------------------------------------- |
| `toPose3d(Transform3d)` | A pose with the transform's translation and rotation. |
| `toTransform3d(Pose3d)` | A transform with the pose's translation and rotation. |
| `toPose2d(Transform2d)` | 2D version of the above.                              |
| `toTransform2d(Pose2d)` | 2D version of the above.                              |

### Alliance flipping

Positions in configuration files are written for the blue alliance. These methods mirror them across the field when the Driver Station reports red, and return the input unchanged on blue or before an alliance is assigned.

| Method                           | Red alliance result                                                 |
| -------------------------------- | ------------------------------------------------------------------- |
| `flipForAlliance(Translation2d)` | Length minus x, width minus y.                                      |
| `flipForAlliance(Translation3d)` | Same, z unchanged.                                                  |
| `flipForAlliance(Pose2d)`        | Translation flipped, rotation plus 180 degrees.                     |
| `flipForAlliance(Pose3d)`        | Translation flipped, rotation plus 180 degrees about z.             |
| `clampToField(Pose2d)`           | Not a flip. Clamps x and y to the field bounds, rotation unchanged. |

Field dimensions come from `Field2026.get().getFieldLayout()`. This is a direct reference to the season package from the library, so the class has to be touched when the year rolls over.

:::info
The flip is a point reflection through the field center, which matches games with rotationally symmetric fields. A game with a mirrored field needs a different flip.
:::

### Constants

`PositionUtil.NaN` holds a NaN valued instance of each geometry type, useful as a sentinel for "no value" where `null` is awkward. `PositionUtil.RotationConstants.ROT_3D_180_DEG` is a 180 degree yaw as a `Rotation3d`.

| Constant            | Type            |
| ------------------- | --------------- |
| `NaN.TRANSLATION2D` | `Translation2d` |
| `NaN.TRANSLATION3D` | `Translation3d` |
| `NaN.ROTATION2D`    | `Rotation2d`    |
| `NaN.ROTATION3D`    | `Rotation3d`    |
| `NaN.POSE2D`        | `Pose2d`        |
| `NaN.POSE3D`        | `Pose3d`        |
| `NaN.TRANSFORM2D`   | `Transform2d`   |
| `NaN.TRANSFORM3D`   | `Transform3d`   |

## MatrixBuilder

`MatrixBuilder<R, C>` fills a WPILib `Matrix` one row or column at a time. It exists because `Matrix` has no readable way to construct a small matrix inline.

```java
import com.aembot.lib.math.MatrixBuilder;
```

| Constructor                                                 | Description                                      |
| ----------------------------------------------------------- | ------------------------------------------------ |
| `MatrixBuilder(Nat<R> rows, Nat<C> cols)`                   | Empty matrix of that size.                       |
| `MatrixBuilder(Nat<R> rows, Nat<C> cols, double... values)` | Intended to fill from a flat array. See warning. |

| Method                                  | Description                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `withRow(int row, double... values)`    | Set a row by index. Missing trailing values become zero. Throws if too many values. |
| `withColumn(int col, double... values)` | Set a column by index. Same rules.                                                  |
| `addRow(double... values)`              | Set the next row in order. Locks the builder into row mode. Throws once full.       |
| `addColumn(double... values)`           | Set the next column in order. Locks the builder into column mode. Throws once full. |
| `get()`                                 | The built `Matrix`.                                                                 |

```java
Matrix<N3, N3> m =
    new MatrixBuilder<>(Nat.N3(), Nat.N3())
        .addRow(1, 0, 0)
        .addRow(0, 1, 0)
        .addRow(0, 0, 1)
        .get();
```

:::warning
The varargs constructor does not work. Its loop condition is `values.length < i` where it should be `i < values.length`, so every cell is set to zero and the values are ignored. It also fills column-major, which contradicts its own documentation. Use `addRow` or `withRow` instead until it is fixed.
:::

## ConcurrentTimeInterpolatableBuffer

`ConcurrentTimeInterpolatableBuffer<T>` stores a short history of timestamped samples and interpolates between them. It is the thread safe version of WPILib's `TimeInterpolatableBuffer`, adapted from Team 254.

```java
import com.aembot.lib.math.ConcurrentTimeInterpolatableBuffer;
```

The use case is latency compensation. A camera frame arrives with the time it was captured. The buffer answers "where was the robot at that time," even if that time falls between two odometry samples.

Samples live in a `ConcurrentSkipListMap`, so one thread can add while another reads with no locking.

| Factory                                                   | Interpolates with                                            |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `createBuffer(Interpolator<T> fn, double historySeconds)` | The given function.                                          |
| `createBuffer(double historySeconds)`                     | `T::interpolate`, for types that implement `Interpolatable`. |
| `createDoubleBuffer(double historySeconds)`               | `MathUtil::interpolate`.                                     |

| Method                             | Description                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `addSample(double time, T sample)` | Add a sample and drop anything older than the history window relative to it.                                              |
| `getSample(double time)`           | Interpolated value at that time. Empty `Optional` if the buffer is empty. Clamps to the nearest sample outside the range. |
| `getLatest()`                      | The newest entry as a `Map.Entry<Double, T>`, or `null`.                                                                  |
| `cleanUp(double time)`             | Drop samples older than the window relative to that time.                                                                 |
| `clear()`                          | Drop everything.                                                                                                          |
| `getInternalBuffer()`              | The underlying map, for iteration.                                                                                        |

```java
var poses = ConcurrentTimeInterpolatableBuffer.<Pose2d>createBuffer(1.0); // one second of history
poses.addSample(t, pose); // from odometry
Pose2d then = poses.getSample(captureTime).orElse(null); // from vision
```

## ConcurrentInterpolatable2DMap

`ConcurrentInterpolatable2DMap<T>` does bilinear interpolation over a grid of points keyed by two doubles. It is meant for lookup tables such as shot velocity as a function of distance and angle.

```java
import com.aembot.lib.math.ConcurrentInterpolatable2DMap;
```

The data must be a regular grid. Every row of the first key needs a value at every column of the second, or lookups near the gap return empty.

| Factory                         | Interpolates with        |
| ------------------------------- | ------------------------ |
| `createMap(Interpolator<T> fn)` | The given function.      |
| `createMap()`                   | `T::interpolate`.        |
| `createDoubleMap()`             | `MathUtil::interpolate`. |

| Method                                    | Description                                                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `addPoint(double k1, double k2, T value)` | Add or replace a grid point.                                                                                                             |
| `getPoint(double k1, double k2)`          | Bilinear interpolation of the four surrounding points. Empty `Optional` if any is missing, including when the query is outside the grid. |
| `getInternalMap()`                        | The nested map, for iteration.                                                                                                           |

Unlike the time buffer, this one does not clamp. Asking for a point past the edge of the grid returns empty rather than the edge value.

## MultistageGearBox

`MultistageGearBox` computes a total reduction from a list of gear pairs.

```java
import com.aembot.lib.math.mechanics.MultistageGearBox;
```

| Method                                        | Description                                               |
| --------------------------------------------- | --------------------------------------------------------- |
| `addStage(int drivingTeeth, int drivenTeeth)` | Append a stage and recompute the ratio. Chainable.        |
| `getTotalRatio()`                             | Product of every stage ratio. `0` if there are no stages. |
| `calculate(double input)`                     | `input / totalRatio`, or `0` if the ratio is zero.        |
| `getStage(int index)`                         | The stage at that index, or `null`.                       |

`MultistageGearBox.Stage` holds one pair with `getDrivingTeeth()`, `getDrivenTeeth()`, `getGearRatio()`, and `getName()`.

:::warning
`Stage.getGearRatio()` divides the driven tooth count by itself and always returns `1.0`, so `getTotalRatio()` is always `1.0` for any non-empty gearbox. The class is not usable for its stated purpose until that line is changed to divide by `kDrivingGearTeethCount`. Nothing in the codebase calls it today.
:::
