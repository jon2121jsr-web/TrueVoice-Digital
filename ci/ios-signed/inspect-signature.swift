// Future macOS worker only: return metadata through the runner's private pipe.
// No certificate extraction, private-key access/export or persistent copy.
import Foundation
import Security
import CryptoKit

func failed() -> Never {
    fputs("Signature metadata unavailable\n", stderr)
    exit(1)
}
guard CommandLine.arguments.count == 2 else { failed() }
var code: SecStaticCode?
let app = URL(fileURLWithPath: CommandLine.arguments[1])
guard SecStaticCodeCreateWithPath(app as CFURL, SecCSFlags(), &code) == errSecSuccess,
      let code = code else { failed() }
var information: CFDictionary?
guard SecCodeCopySigningInformation(code, SecCSFlags(rawValue: UInt32(kSecCSSigningInformation)), &information) == errSecSuccess,
      let values = information as? [String: Any],
      let chain = values[kSecCodeInfoCertificates as String] as? [SecCertificate],
      let leaf = chain.first,
      let team = values[kSecCodeInfoTeamIdentifier as String] as? String,
      let identifier = values[kSecCodeInfoIdentifier as String] as? String else { failed() }
let bytes = SecCertificateCopyData(leaf) as Data
let digest = Insecure.SHA1.hash(data: bytes).map { String(format: "%02X", $0) }.joined()
guard let encoded = try? JSONSerialization.data(withJSONObject: ["team": team, "identifier": identifier, "leafSha1": digest]),
      let text = String(data: encoded, encoding: .utf8) else { failed() }
print(text)
