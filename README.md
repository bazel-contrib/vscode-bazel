# **Bazel LS**

The Bazel lanuage server.

## **Server development**

The server uses Bazel as its build system. To properly run these commands make sure your terminal is operating within the server directory (`cd server`).

### **Build the server**

To build the server, use Bazel's build command.

```
bazel build //:bazel_language_server
```

### **Build the server (as a fat JAR)**

Suffixing the name of the target with '\_deploy.jar' instructs Bazel to package all the dependencies within the jar and make it ready for deployment. To build the server as a fat JAR (with all dependencies included in the jar), use Bazel's build command.

```
bazel build //:bazel_language_server_deploy.jar
```

### **Test the server**

To build the server, use Bazel's build command.

```
bazel test //:bazel_language_server_test
```

---

## **VSCode client development**

When developing the VSCode extension, make sure you open up this project from within the Docker devcontainer` while using VSCode as your IDE.

### **Install dependencies**

The VSCode client is a node project, use npm to install the necessary modules.

```
cd client_vscode && npm i
```

### **Run the development extension host**

Press `F5` from within the VSCode devcontainer from the root of the project. This should open up a development extension host which you can use for debugging.
