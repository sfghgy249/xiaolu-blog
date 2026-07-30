#!/bin/bash

clear
echo "清理下载失败或者早期编译产物"
sleep 1
rm -rf server go go1*

clear
echo "下载go1.26.5"
sleep 1
wget https://go.dev/dl/go1.26.5.linux-amd64.tar.gz

clear
echo "解压go1.26.5"
sleep 1
tar -xvf go1.26.5.linux-amd64.tar.gz

clear
echo "设定临时go根文件夹"
sleep 1
export GOROOT="$(pwd)/go"

clear
echo "编译server.go"
sleep 1
CGO_ENABLED=0 ./go/bin/go build -tags netgo -ldflags="-s -w" server.go

clear
echo "删除源码和go文件夹"
sleep 1
rm -rf go go1.26.5.linux-amd64.tar.gz

clear
echo "DONE"

echo "./start.sh           启动server"
echo "./start-go.sh        启动go脚本server "
