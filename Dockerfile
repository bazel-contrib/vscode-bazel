FROM openjdk:12-jdk-oracle

RUN yum install -y curl \
  && curl -sL https://rpm.nodesource.com/setup_current.x | bash - \
  && yum install -y nodejs

COPY examples /root/bazeldev/examples