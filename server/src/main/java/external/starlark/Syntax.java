package external.starlark;

import com.google.protobuf.RpcCallback;
import com.google.protobuf.RpcController;

import proto.starlark.syntax.ParseFileRequest;
import proto.starlark.syntax.ParseFileResponse;
import proto.starlark.syntax.SyntaxService;

public class Syntax extends SyntaxService {
    @Override
    public void parseFile(RpcController controller, ParseFileRequest request, RpcCallback<ParseFileResponse> done) {

    }
}
