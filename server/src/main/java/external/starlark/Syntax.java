package external.starlark;

import com.google.protobuf.RpcCallback;
import com.google.protobuf.RpcController;

import proto.starlark.ParseFileRequest;
import proto.starlark.ParseFileResponse;
import proto.starlark.SyntaxService;

public class Syntax extends SyntaxService {
    @Override
    public void parseFile(RpcController controller, ParseFileRequest request, RpcCallback<ParseFileResponse> done) {

    }
}
