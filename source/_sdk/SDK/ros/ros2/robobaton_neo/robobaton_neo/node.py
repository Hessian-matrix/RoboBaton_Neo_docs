import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from std_msgs.msg import String
from sensor_msgs.msg import CompressedImage
from robobaton_sdk.ros_adapter import Samples, convert, convert_image, source_header


class NeoOdometry(Node):
    def __init__(self):
        super().__init__('neo_odometry')
        for name, default in (
            ('origin', 'http://192.168.11.1'), ('world_frame', 'neo_world'),
            ('imu_frame', 'neo_imu'), ('assumed_pose_variance', 1000000.0),
            ('assumed_twist_variance', 1000000.0),
            ('image_frame', 'neo_camera_optical'),
        ):
            self.declare_parameter(name, default)
        self.samples = Samples(self.get_parameter('origin').value)
        self.images = Samples(self.get_parameter('origin').value, 'gray_jpeg')
        self.image_publisher = self.create_publisher(CompressedImage, '/neo/image/compressed', 1)
        self.image_headers = self.create_publisher(String, '/neo/image/source_header', 1)
        self.publisher = self.create_publisher(Odometry, '/neo/odometry', 1)
        self.headers = self.create_publisher(String, '/neo/source_header', 1)
        self.timer = self.create_timer(0.01, self.publish_latest)

    def publish_latest(self):
        image = self.images.latest()
        if image is not None:
            self.image_publisher.publish(convert_image(
                image, CompressedImage(), self.get_clock().now().to_msg(),
                self.get_parameter('image_frame').value))
            self.image_headers.publish(String(data=source_header(image)))
        sample = self.samples.latest()
        if sample is None:
            return
        message = convert(
            sample, Odometry(), self.get_clock().now().to_msg(),
            self.get_parameter('world_frame').value, self.get_parameter('imu_frame').value,
            float(self.get_parameter('assumed_pose_variance').value),
            float(self.get_parameter('assumed_twist_variance').value),
        )
        if message is not None:
            self.publisher.publish(message)
            self.headers.publish(String(data=source_header(sample)))


def main(args=None):
    rclpy.init(args=args)
    node = None
    try:
        node = NeoOdometry()
        rclpy.spin(node)
    finally:
        if node is not None:
            node.samples.close()
            node.images.close()
            node.destroy_node()
        rclpy.shutdown()
