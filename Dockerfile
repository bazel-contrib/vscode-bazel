FROM ubuntu:18.04

RUN apt update

# Install miscellaneous tools
RUN apt install -y git && \
    apt install -y openssh-client && \
    apt install -y curl && \
    apt install -y gnupg && \
    apt install -y software-properties-common

# Install node
RUN apt install -y nodejs && \
    apt install -y npm

# Install java
RUN apt install -y openjdk-11-jdk
    
# Install bazel
RUN (curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > /etc/apt/trusted.gpg.d/bazel.gpg) && \
    (echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" | tee /etc/apt/sources.list.d/bazel.list) && \
    apt update && \
    apt install -y bazel

# Set the default shell to bash
ENV SHELL /bin/bash
