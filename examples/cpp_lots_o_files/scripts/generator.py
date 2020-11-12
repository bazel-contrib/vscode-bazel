#!/usr/bin/python3.7
#
# A really poorly written file generator :)

import sys
import pathlib
import os
import shutil

argc = len(sys.argv)
argv = sys.argv

if argc != 3:
    print(f'USAGE: ./generator.py <level_count> <packages_per_level>')
    exit(1)

arg_file_name = argv[0]
arg_level_count = int(argv[1])
arg_packages_per_level = int(argv[2])

file_dir = pathlib.Path(__file__).parent.absolute()

PROJECTED_PACKAGE_COUNT = arg_packages_per_level ** arg_level_count
DIR_ROOT = f'{file_dir}/../generated'
DIR_MAIN_PROJECT = f'{DIR_ROOT}/main_project'
DIR_MAIN_PROJECT_CORE = f'{DIR_MAIN_PROJECT}/core'

if PROJECTED_PACKAGE_COUNT > 500000:
    print('[WARNING]: You are attempting to generate more than 500,000 files. This could take while!')

print(f'LOTS O\' FILES GENERATOR');
print(f'- level_count={arg_level_count}')
print(f'- packages_per_level={arg_packages_per_level}')
print('')
print('RUNNING GENERATOR...')

class Node:
    def __init__():
        self.deps = []

def log_info(msg):
    print(f'[Info]: {msg}')

def write_file(path, content):
    dir_name = os.path.dirname(path)
    if not os.path.exists(dir_name):
        os.makedirs(dir_name)
    f = open(path, 'w+')
    f.write(content)
    f.close()

def gen_str_CC_include_list(array):
    result = ''
    for elem in array:
        result += f'#include "{elem}"\n'
    return result

def gen_str_CC_function_list(array):
    result = ''
    for elem in array:
        result += f'{elem}\n'
    return result

def gen_str_BAZEL_string_array_items(array):
    result = ''
    for elem in array:
        result += f'"{elem}",'
    return result

def gen_str_BAZEL_cc_library(name='', srcs=[], hdrs=[], deps=[]):
    return f'''
cc_library(
    name = "{name}",
    srcs = [{gen_str_BAZEL_string_array_items(srcs)}],
    hdrs = [{gen_str_BAZEL_string_array_items(hdrs)}],
    deps = [{gen_str_BAZEL_string_array_items(deps)}],
    visibility = ["//visibility:public"],
)
    '''

def gen_str_BAZEL_cc_binary(name='', srcs=[], deps=[]):
    return f'''
cc_binary(
    name = "{name}",
    srcs = [{gen_str_BAZEL_string_array_items(srcs)}],
    deps = [{gen_str_BAZEL_string_array_items(deps)}],
)
    '''

class FSNode:
    def __init__(self):
        self.build_deps = list()
        self.build_srcs = list()
        self.build_hdrs = list()
        self.build_name = ''
        self.cc_includes = list()
        self.cc_function_calls = list()
        self.directory = ''
        self.pkg_name = ''

def clean_file_system():
    if os.path.exists(DIR_ROOT):
        shutil.rmtree(DIR_ROOT)

def create_fsnode_list(deps, level, dir_name, abs_dir_name):
    next_level = level + 1

    for i in range(arg_packages_per_level):
        pkg_name = f'level{level}_package{i}'
        pkg_dir_name = f'{dir_name}/{pkg_name}' if dir_name != '' else pkg_name
        pkg_abs_dir_name = f'{abs_dir_name}/{pkg_name}'

        node = FSNode()
        node.build_name = pkg_name
        node.build_srcs.append(f'{pkg_name}.cc')
        node.build_hdrs.append(f'{pkg_name}.hh')
        node.directory = pkg_abs_dir_name
        node.pkg_name = pkg_name
        
        for j in range(arg_packages_per_level):
            next_pkg_name = f'level{next_level}_package{j}'
            next_pkg_dir_name = f'{pkg_dir_name}/{next_pkg_name}'
            if next_level < arg_level_count:
                node.build_deps.append(f'//{next_pkg_dir_name}:{next_pkg_name}')
                node.cc_includes.append(f'{next_pkg_dir_name}/{next_pkg_name}.hh')
                node.cc_function_calls.append(f'{next_pkg_name}();')

        deps.append(node)

    if next_level < arg_level_count:
        for i in range(arg_packages_per_level):
            pkg_name = f'level{level}_package{i}'
            pkg_dir_name = f'{dir_name}/{pkg_name}'
            pkg_abs_dir_name = f'{abs_dir_name}/{pkg_name}'
            create_fsnode_list(deps, next_level, pkg_dir_name, pkg_abs_dir_name)

log_info('Cleaning up old files...')
clean_file_system()

log_info('Building file system skeleton...')
fsnodes = []
create_fsnode_list(fsnodes, 0, '', DIR_MAIN_PROJECT)

log_info('Generating packages...')
for node in fsnodes:

    # Build hh files
    write_file(
        f'{node.directory}/{node.pkg_name}.hh', 
        f'''
#include <string>
#include <iostream>

{gen_str_CC_include_list(node.cc_includes)}

void {node.pkg_name}();
        '''
    )

    # Build cc files
    write_file(
        f'{node.directory}/{node.pkg_name}.cc', 
        f'''
#include "{node.pkg_name}.hh"

void {node.pkg_name}()
{{
    {gen_str_CC_function_list(node.cc_function_calls)}
    std::cout << "Hello from {node.pkg_name}" << std::endl;
}}
        '''
    )
    
    # Build BUILD files
    write_file(
        f'{node.directory}/BUILD', 
        f'''
load("@rules_cc//cc:defs.bzl", "cc_binary", "cc_library")

{gen_str_BAZEL_cc_library(name=node.pkg_name, srcs=node.build_srcs, hdrs=node.build_hdrs, deps=node.build_deps)}
        '''
    )

log_info('Generating core...')
build_deps = []
includes = []
function_calls = []
for i in range(arg_packages_per_level):
    pkg_name = f'level{0}_package{i}'
    build_deps.append(f'//{pkg_name}:{pkg_name}')
    includes.append(f'{pkg_name}/{pkg_name}.hh')
    function_calls.append(f'{pkg_name}();')
    
write_file(
    f'{DIR_MAIN_PROJECT}/WORKSPACE', 
    f'''
    ''')

main_pkg_name = 'main'
write_file(
    f'{DIR_MAIN_PROJECT_CORE}/BUILD', 
    f'''
load("@rules_cc//cc:defs.bzl", "cc_binary", "cc_library")

{gen_str_BAZEL_cc_binary(name=main_pkg_name, srcs=['main.cc'], deps=build_deps)}
    ''')

write_file(
    f'{DIR_MAIN_PROJECT_CORE}/main.cc', 
    f'''
#include <iostream>
#include <string>

{gen_str_CC_include_list(includes)}

int main(int argc, char** argv) {{
    {gen_str_CC_function_list(function_calls)}
    return 0;
}}
    ''')

log_info(f'Done! Generated {PROJECTED_PACKAGE_COUNT} packages.')
