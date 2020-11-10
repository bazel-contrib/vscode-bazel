#!/usr/bin/python3.7

import sys
import pathlib
import os

argc = len(sys.argv)
argv = sys.argv

if argc != 3:
    print(f'USAGE: ./generator.py <packages_per_level> <level_count>')
    exit(1)

arg_file_name = argv[0]
arg_packages_per_level = argv[1]
arg_level_count = argv[2]

file_dir = pathlib.Path(__file__).parent.absolute()
root_dir = f'{file_dir}/../generated'

print(f'LOTS O\' FILES GENERATOR');
print(f'- packages_per_level={arg_packages_per_level}')
print(f'- level_count={arg_level_count}')
print('')
print('Running...')

def write_file(path, content):
    dir_name = os.path.dirname(path)
    if not os.path.exists(dir_name):
        os.makedirs(dir_name)
    f = open(path, 'w+')
    f.write(content)
    f.close()

write_file(
    f'{root_dir}/main.cc', 
    f'''
    #include <string>
    #include <iostream>

    int main(int argc, char** argv) {{
        std::cout << "Hello world!" << std::endl;
        return 0;
    }}
    '''
)