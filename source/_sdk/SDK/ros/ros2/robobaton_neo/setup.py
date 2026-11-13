from setuptools import setup

setup(
    name='robobaton_neo',
    version='0.1.0',
    packages=['robobaton_neo'],
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/robobaton_neo']),
        ('share/robobaton_neo', ['package.xml']),
    ],
    install_requires=['setuptools'],
    maintainer='RoboBaton',
    maintainer_email='hust_linyicheng@qq.com',
    description='RoboBaton Neo public HTTP odometry example',
    license='Proprietary',
    entry_points={'console_scripts': ['neo_odometry = robobaton_neo.node:main']},
)
