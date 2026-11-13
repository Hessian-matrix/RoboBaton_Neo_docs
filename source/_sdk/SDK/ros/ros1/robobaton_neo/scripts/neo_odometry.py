#!/usr/bin/env python3
import rospy
from nav_msgs.msg import Odometry
from std_msgs.msg import String
from sensor_msgs.msg import CompressedImage
from robobaton_sdk.ros_adapter import Samples, convert, convert_image, source_header


def main():
    rospy.init_node('neo_odometry')
    samples = Samples(rospy.get_param('~origin', 'http://192.168.11.1'))
    images = Samples(rospy.get_param('~origin', 'http://192.168.11.1'), 'gray_jpeg')
    image_frame = rospy.get_param('~image_frame', 'neo_camera_optical')
    image_publisher = rospy.Publisher('/neo/image/compressed', CompressedImage, queue_size=1)
    image_headers = rospy.Publisher('/neo/image/source_header', String, queue_size=1)
    world = rospy.get_param('~world_frame', 'neo_world')
    imu = rospy.get_param('~imu_frame', 'neo_imu')
    pose_variance = float(rospy.get_param('~assumed_pose_variance', 1000000.0))
    twist_variance = float(rospy.get_param('~assumed_twist_variance', 1000000.0))
    publisher = rospy.Publisher('/neo/odometry', Odometry, queue_size=1)
    headers = rospy.Publisher('/neo/source_header', String, queue_size=1)
    rate = rospy.Rate(100)
    try:
        while not rospy.is_shutdown():
            image = images.latest()
            if image is not None:
                image_publisher.publish(convert_image(image, CompressedImage(), rospy.Time.now(), image_frame))
                image_headers.publish(String(data=source_header(image)))
            sample = samples.latest()
            if sample is not None:
                message = convert(sample, Odometry(), rospy.Time.now(), world, imu, pose_variance, twist_variance)
                if message is not None:
                    publisher.publish(message)
                    headers.publish(String(data=source_header(sample)))
            rate.sleep()
    finally:
        samples.close()
        images.close()


if __name__ == '__main__':
    try:
        main()
    except rospy.ROSInterruptException:
        pass
