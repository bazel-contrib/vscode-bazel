package server.bazel.interp;

// IDEA:
// Lazily build the graph by ONLY appending nodes that you see when looking at a
// BUILD file. This would mean that if you haven't seen the dep "x" yet, but it
// exists, and you just opened up a BUILD file with the "x" dep, then an "x" dep
// would be created.
// 
// SourceGraph.addNode(buildFile)
// SourceGraph.removeNode(buildFile)
public class SourceGraph {
}
