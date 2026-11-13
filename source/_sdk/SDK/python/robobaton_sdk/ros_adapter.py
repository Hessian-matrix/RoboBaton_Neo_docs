import json
import math
import queue
import threading

from .client import Device


class Samples:
    def __init__(self, origin, channel='odometry'):
        if channel not in ('odometry', 'gray_jpeg'):
            raise ValueError('Choose odometry or gray_jpeg')
        self.channel = channel
        self.items = queue.Queue(maxsize=1)
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self._read, args=(origin,), daemon=True)
        self.thread.start()

    def _put(self, value):
        try:
            self.items.put_nowait(value)
        except queue.Full:
            try:
                self.items.get_nowait()
            except queue.Empty:
                pass
            self.items.put_nowait(value)

    def _read(self, origin):
        stream = None
        try:
            stream = Device(origin).observe([self.channel])
            previous_seq = None
            previous_ns = None
            for name, fmt, sequence, value in stream:
                if self.stop.is_set():
                    break
                if name != self.channel:
                    continue
                seq = int(value['header']['seq'])
                stamp = value['header']['stamp']
                if previous_seq is not None and seq <= previous_seq:
                    raise ValueError('Device sequence reset; start a new ROS session')
                previous_seq = seq
                if stamp is not None:
                    ns = stamp['sec'] * 10**9 + stamp['nanosec']
                    if previous_ns is not None and ns <= previous_ns:
                        raise ValueError('Device clock reset; start a new ROS session')
                    previous_ns = ns
                self._put(value)
            if not self.stop.is_set():
                raise ConnectionError('Device stream ended; start a new ROS session')
        except Exception as error:
            self._put(error)
        finally:
            if stream is not None:
                stream.close()

    def latest(self):
        try:
            value = self.items.get_nowait()
        except queue.Empty:
            return None
        if isinstance(value, Exception):
            raise value
        return value

    def close(self):
        self.stop.set()
        self.thread.join(timeout=0.5)


def convert(sample, message, stamp, world_frame, imu_frame, pose_variance, twist_variance):
    if sample['pose'] is None or sample['twist'] is None or sample['header']['stamp'] is None:
        return None
    if not world_frame or not imu_frame or world_frame == imu_frame:
        raise ValueError('Use distinct nonempty world/IMU frame names')
    for value in (pose_variance, twist_variance):
        if not math.isfinite(value) or value <= 0:
            raise ValueError('Assumed variance must be finite and positive')
    message.header.stamp = stamp
    message.header.frame_id = world_frame
    message.child_frame_id = imu_frame
    for axis in ('x', 'y', 'z'):
        setattr(message.pose.pose.position, axis, sample['pose']['position'][axis])
        setattr(message.twist.twist.linear, axis, sample['twist']['linear'][axis])
        setattr(message.twist.twist.angular, axis, sample['twist']['angular'][axis])
    for axis in ('x', 'y', 'z', 'w'):
        setattr(message.pose.pose.orientation, axis, sample['pose']['orientation'][axis])
    message.pose.covariance = [pose_variance if index % 7 == 0 else 0.0 for index in range(36)]
    message.twist.covariance = [twist_variance if index % 7 == 0 else 0.0 for index in range(36)]
    return message


def source_header(sample):
    return json.dumps(sample['header'], separators=(',', ':'))


def convert_image(sample, message, stamp, frame):
    if not frame:
        raise ValueError('Use a nonempty image optical frame')
    message.header.stamp = stamp
    message.header.frame_id = frame
    message.format = 'mono8; jpeg compressed mono8'
    message.data = sample['data']
    return message
