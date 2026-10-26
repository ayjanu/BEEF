defmodule BeefChat.Id do
  @moduledoc "Random (version 4) UUIDs for message ids."
  import Bitwise

  def uuid4 do
    <<a::binary-6, b::binary-2, c::binary-8>> = :crypto.strong_rand_bytes(16)
    <<b1, b2>> = b
    <<c1, rest::binary>> = c
    bytes = <<a::binary, (b1 &&& 0x0F) ||| 0x40, b2, (c1 &&& 0x3F) ||| 0x80, rest::binary>>
    <<p1::binary-4, p2::binary-2, p3::binary-2, p4::binary-2, p5::binary-6>> = bytes
    Enum.map_join([p1, p2, p3, p4, p5], "-", &Base.encode16(&1, case: :lower))
  end
end
