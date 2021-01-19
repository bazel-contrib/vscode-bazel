FROM ubuntu:18.04

RUN apt update

# Install miscellaneous tools
RUN apt install -y git && \
    apt install -y openssh-client && \
    apt install -y curl && \
    apt install -y gnupg && \
    apt install -y software-properties-common

# Install node
RUN curl -sL https://deb.nodesource.com/setup_15.x | bash && \
    apt-get install -y nodejs

# Install python (and pip)
RUN apt install -y python3.7 && \
    apt install -y python3.7-dev && \
    apt install -y python3.7-distutils && \
    update-alternatives --install /usr/bin/python python /usr/bin/python3.7 1 && \
    update-alternatives --set python /usr/bin/python3.7 && \
    curl -s https://bootstrap.pypa.io/get-pip.py -o get-pip.py && \
    python get-pip.py --force-reinstall && \
    rm get-pip.py

# Install golang (and common dependencies)
RUN curl -sL https://dl.google.com/go/go1.15.6.linux-amd64.tar.gz | tar -C /usr/local -xz && \
    export PATH=$PATH:/usr/local/go/bin && \
    go get -v github.com/uudashr/gopkgs/v2/cmd/gopkgs && \
    go get -v github.com/ramya-rao-a/go-outline && \
    go get -v github.com/rogpeppe/godef && \
    go get -v github.com/sqs/goreturns && \
    go get -v golang.org/x/lint/golint && \
    go get -v github.com/acroca/go-symbols && \
    go get -v github.com/stamblerre/gocode

# Install java
RUN apt install -y openjdk-11-jdk
    
# Install bazel
RUN (curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor > /etc/apt/trusted.gpg.d/bazel.gpg) && \
    (echo "deb [arch=amd64] https://storage.googleapis.com/bazel-apt stable jdk1.8" | tee /etc/apt/sources.list.d/bazel.list) && \
    apt update && \
    apt install -y bazel

# Install buildifier
RUN curl -LJ https://github.com/bazelbuild/buildtools/releases/download/3.5.0/buildifier > /usr/bin/buildifier &&  \
    chmod 766 /usr/bin/buildifier

# Set the default shell to bash
ENV SHELL /bin/bash
