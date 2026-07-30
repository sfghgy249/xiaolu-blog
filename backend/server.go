package main

import (
	"fmt"
	"net/http"
)

func main() {
	mux := http.FileServer(http.Dir("../"))
	http.Handle("/", mux)
	fmt.Printf("服务器端口: *:8080\nCtrl C 退出程序")
	http.ListenAndServe(":8080", mux)

}
