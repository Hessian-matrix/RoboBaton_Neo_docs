import argparse,json,sys
import tarfile,zipfile
from .reader import inspect,export

def main():
    p=argparse.ArgumentParser(description='Inspect, check or export RoboBaton RBR1 recordings without modifying input.')
    p.add_argument('command',choices=['inspect','check','export'])
    p.add_argument('inputs',nargs='+')
    p.add_argument('--output',help='New directory for export; existing directories are never overwritten')
    args=p.parse_args()
    try:
        if args.command=='export':
            if not args.output:p.error('export requires --output')
            result=export(args.inputs,args.output)
        else:result=inspect(args.inputs)
        print(json.dumps(result,ensure_ascii=False,indent=2))
        return 0 if result['valid'] else 2
    except (ValueError,OSError,tarfile.TarError,zipfile.BadZipFile) as error:
        print(str(error),file=sys.stderr);return 2
if __name__=='__main__':sys.exit(main())
