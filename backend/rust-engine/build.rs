fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Ensure output directory exists
    std::fs::create_dir_all("src/proto")?;

    // Use local protoc binary
    let protoc_path = std::path::Path::new("protoc/protoc.exe");
    if protoc_path.exists() {
        std::env::set_var("PROTOC", protoc_path.to_str().unwrap());
        println!(
            "cargo:warning=Using local protoc at: {}",
            protoc_path.to_str().unwrap()
        );
    } else {
        println!(
            "cargo:warning=Local protoc not found at: {}",
            protoc_path.to_str().unwrap()
        );
    }

    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .out_dir("src/proto")
        .compile_protos(&["proto/wallet.proto", "proto/payment.proto"], &["proto"])?;

    println!("cargo:rerun-if-changed=proto/wallet.proto");
    println!("cargo:rerun-if-changed=proto/payment.proto");
    Ok(())
}
