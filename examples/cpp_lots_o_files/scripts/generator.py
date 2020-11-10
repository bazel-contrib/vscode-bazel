#!/usr/bin/python3.7

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

DIR_ROOT = f'{file_dir}/../generated'
DIR_MAIN_PROJECT = f'{DIR_ROOT}/main_project'
DIR_MAIN_PROJECT_CORE = f'{DIR_MAIN_PROJECT}/core'

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
        result += f'"{elem}",'
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
)
    '''

def gen_str_BAZEL_cc_binary(name='', srcs=[], hdrs=[], deps=[]):
    return f'''
cc_binary(
    name = "{name}",
    srcs = [{gen_str_BAZEL_string_array_items(srcs)}],
    hdrs = [{gen_str_BAZEL_string_array_items(hdrs)}],
    deps = [{gen_str_BAZEL_string_array_items(deps)}],
)
    '''

class FSNode:
    def __init__(self):
        self.build_deps = []
        self.build_srcs = []
        self.build_hdrs = []
        self.build_name = ''
        self.cc_includes = []
        self.cc_function_calls = []
        self.directory = ''

def clean_file_system():
    if os.path.exists(DIR_ROOT):
        shutil.rmtree(DIR_ROOT)

def create_fsnode_list(deps, level, dir_name):
    next_level = level + 1

    for i in range(arg_packages_per_level):
        pkg_name = f'level{level}_package{i}'
        pkg_dir_name = f'{dir_name}/{pkg_name}'
        print(pkg_dir_name)

        node = FSNode()
        node.build_name = pkg_name
        node.build_srcs.append(f'{pkg_name}.cc')
        node.build_hdrs.append(f'{pkg_name}.hh')
        node.directory = pkg_dir_name
        node.cc_function_calls.append(f'std::cout << "Hello from {pkg_name}" << std::endl;')
        
        for j in range(arg_packages_per_level):
            next_pkg_name = f'level{next_level}_package{j}'
            next_pkg_dir_name = f'{pkg_dir_name}/{next_pkg_name}'

            if next_level < arg_level_count:
                node.build_deps.append(f'{next_pkg_dir_name}')
                node.cc_includes.append(f'{next_pkg_name}.hh')
                node.cc_function_calls.append(f'{next_pkg_name}();')

        deps.append(node)

    if next_level < arg_level_count:
        for i in range(arg_packages_per_level):
            pkg_name = f'level{level}_package{i}'
            pkg_dir_name = f'{dir_name}/{pkg_name}'
            create_fsnode_list(deps, next_level, pkg_dir_name)

log_info('Cleaning up old files...')
clean_file_system()

log_info('Building file system skeleton...')
fsnodes = []
create_fsnode_list(fsnodes, 0, DIR_MAIN_PROJECT)

for node in fsnodes:
    print('dir: ' + node.directory)
    print('build_deps: ' + str(node.build_deps))
    print('build_srcs: ' + str(node.build_srcs))
    print('build_hdrs: ' + str(node.build_hdrs))
    print('build_name: ' + str(node.build_name))
    print('cc_includes: ' + str(node.cc_includes))
    print('cc_function_calls: ' + str(node.cc_function_calls))
    print('')

# write_file(
#     f'{DIR_MAIN_PROJECT_CORE}/main.cc', 
#     f'''
# #include <string>
# #include <iostream>

# int main(int argc, char** argv) {{
#     std::cout << "Hello world!" << std::endl;
#     return 0;
# }}
#     '''
# )

# write_file(
#     f'{DIR_MAIN_PROJECT_CORE}/BUILD', 
#     f'''
#     '''
# )

# write_file(
#     f'{DIR_MAIN_PROJECT}/WORKSPACE', 
#     f'''
#     '''
# )

# for j in range(arg_packages_per_level):
#     package_name = f'package{j}_level{0}'
#     dir_name = f'{DIR_MAIN_PROJECT}/{package_name}'

#     write_file(
#         f'{dir_name}/BUILD', 
#         f'''
# load("@rules_cc//cc:defs.bzl", "cc_binary", "cc_library")

# {gen_str_BAZEL_cc_library(name=package_name, srcs=[], hdrs=[], deps=[])}
#         '''
#     )

#     write_file(
#         f'{dir_name}/{package_name}.cc', 
#         f'''
#         '''
#     )

#     write_file(
#         f'{dir_name}/{package_name}.hh', 
#         f'''
#         '''
#     )

# arg_file_name = argv[0]
# arg_level_count = int(argv[1])
# arg_packages_per_level = int(argv[2])

# print(gen_str_BAZEL_cc_library('hello',['1.cc', '2.cc', '3.cc'], ['1.hh', '2.hh', '3.hh'], ['1', '2', '3']))
