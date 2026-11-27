import json,subprocess,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
ffmpeg=root/'tmp/web-tutorials/browsers/ffmpeg-1011/ffmpeg-win64.exe'
for language in ('zh','en'):
    scratch=root/('tmp/mount-film-'+language)
    output=root/('site' if language=='zh' else 'locales/en-media/site')
    output.mkdir(parents=True,exist_ok=True)
    data=[(scratch/('frame-'+str(i).zfill(3)+'.jpg')).read_bytes() for i in range(172)]
    encoder=subprocess.Popen([str(ffmpeg),'-y','-loglevel','error','-f','image2pipe','-c:v','mjpeg','-r','25','-i','pipe:0','-an','-c:v','libvpx','-deadline','realtime','-cpu-used','8','-crf','12','-b:v','1800k',str(output/'mount-workflow.webm')],stdin=subprocess.PIPE)
    for i in range(537):encoder.stdin.write(data[min(171,int(i*8/25))])
    encoder.stdin.close()
    assert encoder.wait()==0
    from PIL import Image
    with Image.open(scratch/'frame-000.jpg') as image:image.save(output/'mount-workflow-poster.png')
    print('PASS mount movie',language,flush=True)
