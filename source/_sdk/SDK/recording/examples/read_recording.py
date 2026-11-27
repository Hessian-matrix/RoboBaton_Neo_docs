"""Run from SDK/recording: python examples/read_recording.py recording.zip"""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from neo_recording import iter_records

for segment,record in iter_records(sys.argv[1:]):
    if record['type']=='data' and record['channel']=='imu':
        data=record['metadata']['data']
        print(segment,data['header'],data)
